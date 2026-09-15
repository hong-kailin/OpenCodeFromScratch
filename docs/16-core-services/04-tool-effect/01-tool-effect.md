# 16.4 工具 Effect 化：execute 从 Promise 变成 Effect

> 阶段 16 的地图见 [16.0 总览](../00-overview/01-overview.md)。
> 本课让工具真正用上 16.3 的 FileSystem 服务——execute 从 `Promise<string>`
> 变成 `Effect<string>`，工具内部 `yield* FileSystemService` 取依赖。

## 这一步做什么

6 个工具的 execute 全部从 `(args) => Promise<string>` 改成 `(args) => Effect<string>`。
文件操作不再直接调 Bun API，改为从 Context 取 FileSystem 服务。

对照代码：`packages/core/src/tool/tool.ts` + `tool/read.ts` 等 6 个工具、
`packages/opencode/src/agent-loop.ts`、入口 `index.ts` / `tui/agent.tsx`

## 为什么 execute 必须变成 Effect

16.3 建了 FileSystem 服务，但工具**用不上**——因为：

```typescript
// 之前：execute 是普通 async 函数
async function execute(args): Promise<string> {
  const file = Bun.file(args.filePath)   // 直接碰 I/O，拿不到服务
  return await file.text()
}
```

async 函数体里**没有 Context**，没法 `yield* FileSystemService`。
而 Effect 函数体里有——`yield*` 就是"从 Context 取服务"的语法。

所以：**想让工具从 Context 取依赖，execute 必须是 Effect**。

## Tool 接口加第三泛型 R

```typescript
// packages/core/src/tool/tool.ts
export interface Tool<
  Parameters extends Schema.Decoder<unknown> = Schema.Decoder<unknown>,
  R = never,
> {
  id: string
  description: string
  parameters: Parameters
  execute(args: Schema.Schema.Type<Parameters>): Effect.Effect<string, never, R>
}
```

> **小知识：`Effect<A, E, R>` 三个类型参数是什么意思？**
> Effect 类型带三个参数，分别代表"这段计算"的三个维度：
>
> ```
> Effect<A, E, R>
>   A -- 成功值类型：跑完后返回什么（A 来自 "success Value"）
>   E -- 错误类型：可能以什么方式失败（E 来自 "Error"）
>   R -- 依赖类型：需要哪些服务才能跑（R 来自 "Requirements"）
> ```
>
> 类比 Python：相当于一个函数标注了 `(返回值类型, 可能抛的异常类型, 需要什么依赖)`。
>
> 那这里的 `never` 是什么？never 是 TS 的**"不可能类型"**——没有任何值属于它。
> 放在 Effect 的不同位置，含义正好对应它的两个用途：
>
> - **E 位置的 never = "绝不失败"**。execute 的错误不会让 Effect 失败——工具出错时
>   由 agent-loop 兜底（`Effect.catch`）转成文本喂回 LLM，所以错误类型是 never。
> - **R 位置的 never = "不需要任何依赖"**。bash 工具直接跑命令，不碰任何服务，
>   所以它的 R 就是 never（不写第二个泛型，用默认值）。
>
> 于是 `Effect<string, never, R>` 读作：**"返回 string、不会失败、需要 R 这些服务"**。

**第三泛型 R** 是新增的，声明"执行这个工具需要哪些服务"：

- `readTool: Tool<typeof Parameters, FileSystemService>` —— 读文件需要 FileSystem 服务
- `bashTool: Tool<typeof Parameters>`（R 默认 never）—— 跑命令不需要任何服务

这个 R 不是摆设：类型系统会强制"执行 read 时 Context 里必须有 FileSystemService"，
否则编译报错。**把运行时依赖写进类型里**——这是 Effect 体系的精髓。

## 工具改造：以 read 为例

```typescript
// packages/core/src/tool/read.ts
const execute = (args: Schema.Schema.Type<typeof Parameters>) =>
  Effect.gen(function* () {
    // 从 Context 取 FileSystem 服务
    const fs = yield* FileSystemService
    const filePath = args.filePath

    // fs.read 返回 Promise，用 Effect.promise 桥接进 Effect 世界
    const text = yield* Effect.promise(() => fs.read(filePath))
    if (text === null) return `错误：文件 ${filePath} 不存在`

    // ... 加行号、组装输出（和之前一样）
    return output
  })

export const readTool: Tool<typeof Parameters, FileSystemService> = {
  id: "read",
  description: DESCRIPTION,
  parameters: Parameters,
  execute,
}
```

对照之前的版本，变化很清晰：
- `async function execute(...)` → `const execute = (...) => Effect.gen(function* () {...})`
- `Bun.file(filePath).text()` → `yield* FileSystemService` + `Effect.promise(() => fs.read(...))`
- 工具声明里多了一个 R：`Tool<typeof Parameters, FileSystemService>`

bash 工具例外：它用 Bun.spawn 跑命令，不碰文件，所以 R = never（不写第二个泛型）。

## agent-loop 适配：最微妙的部分

工具 execute 返回 Effect 后，agent-loop 的执行处要改。但这里有个**类型陷阱**：

**陷阱：R 退化成 any**

注册表存的是 `Tool<any, any>[]`（不同工具 R 不同，注册表无法统一，用 any 兜底）。
从注册表取出的工具，`tool.execute(args)` 的类型是 `Effect<string, never, any>`。

Effect 有个已知特性：**只要 yield* 的 Effect 的 R 是 any，整个 generator 的 R 就
退化成 any**（污染）。污染后 runAgentLoop 的依赖类型变宽松，类型安全失效。

**解法：运行时喂服务 + 类型断言收干净**

```typescript
// agent-loop.ts
const fs = yield* FileSystemService   // 开头先拿到 FileSystem 实例

// 执行工具：
Effect.flatMap((args) =>
  // 运行时：把 fs 喂进工具执行的 Context（工具真正需要的服务）
  tool.execute(args).pipe(Effect.provideService(FileSystemService, fs)),
)
// ...
.pipe(
  Effect.catch((e) => Effect.succeed(e instanceof Error ? e.message : String(e))),
  // 类型：在"最终结果"上断言 R=never，防止污染 runAgentLoop 的 R
  (effect) => effect as Effect.Effect<string, never, never>,
)
```

拆开看这个方案的两半：

1. **运行时**：`Effect.provideService(FileSystemService, fs)` 把实例塞进 Context。
   工具的 `yield* FileSystemService` 就能取到。这是真实的服务注入。
2. **类型**：`as Effect.Effect<string, never, never>` 告诉 tsc"工具需要的服务
   已经全部提供，R 收干净"。这里的 R=never 就是上面的小知识里说的——
   **"不再需要任何服务，依赖已全部满足"**（FileSystem 已经用 provideService 喂进去了）。
   这样 generator 只 yield* 一个 R=never 的 Effect，不污染 runAgentLoop。

> 对照 opencode：它在更早的层面 provide 完整 Context，我们这里是"执行时即时提供"。
> 两种思路都对，我们选更贴近当前结构的。

## 入口改动：provide fileSystemLayer

工具 execute 需要 FileSystem 服务，所以入口的 Layer 组装要加上：

```typescript
// index.ts 和 tui/agent.tsx
const appLayers = Layer.mergeAll(
  configLayer,
  satisfiedProvider,
  toolRegistryLayer,
  fileSystemLayer,   // 新增：工具执行需要它
)
```

## 教 debug

**场景 1**：typecheck 报 `Type 'any' is not assignable to type 'never'`。

排查：这是 provider 接口的 tools 参数还是 `Tool[]`（R=never）导致的——注册表返回
`Tool<any, any>[]`，类型不匹配。把 Provider / ProviderService 的 tools 参数
放宽成 `Tool<any, any>[]`（LLM 侧只看 id/description/parameters，不关心 R）。

**场景 2**：运行工具报"FileSystem 服务未提供"或取到 undefined。

排查：工具 execute 里 `yield* FileSystemService`，但执行处的
`Effect.provideService(FileSystemService, fs)` 没加，或者入口 mergeAll 漏了
`fileSystemLayer`。检查这两处。

## 验证：这一步成功标志

```bash
bunx tsc --noEmit
bun run packages/opencode/src/index.ts run "用read工具读一下 packages/opencode/src/index.ts 的前20行"
# 期望：LLM 调用 read 工具，正常返回文件内容——工具 Effect 化链路跑通
```

## 这一步解决了什么、还没解决什么

| 问题 | 解决了吗 | 说明 |
|------|---------|------|
| 工具从 Context 取服务 | ✅ | execute 变 Effect，`yield* FileSystemService` |
| 工具真正用上 FileSystem 服务 | ✅ | read/write/edit/glob/grep 全走服务 |
| 工具注册机制 | ❌ | 还是集中列表（registry 里写死数组）——16.5 改成去中心化注册 |

## 对照 opencode

| 我们 | opencode |
|------|----------|
| `Tool` 接口 execute 返回 `Effect<string>` | `opencode/src/tool/tool.ts` 的 Def，返回 `Effect<ExecuteResult>` |
| `R` 泛型声明工具需要的服务 | Def 里有 Context（后续权限/abort 等） |
| 执行处 `provideService` + 断言 | 更早层面 provide 完整 Context |

opencode 的 execute 返回类型更复杂（`{ output, title, metadata, suggestedNextStep }`），
我们先用 `Effect<string>`，后续阶段演进。

## 小结

第 4 步做完：
- execute 从 Promise 变 Effect，工具能从 Context 取 FileSystem 服务
- Tool 接口加 R 泛型，把"工具需要什么服务"写进类型
- agent-loop 用 provideService 注入服务 + 断言 R=never 收干净

## 下一步

[16.5 ToolRegistry 去中心化注册](../05-tool-registry/01-tool-registry.md)
——把"集中数组硬编码"改成"工具各自注册"（对照 opencode 的真实模式）。
