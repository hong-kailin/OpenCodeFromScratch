# 16.4 第 4 步：Tool 注册表服务化——工具 Effect 化 + 注册表升级

> 对照代码：`packages/core/src/tool/tool.ts`（Tool 接口）、
> `packages/core/src/tool/registry.ts`（ToolRegistry）、
> `packages/opencode/src/agent-loop.ts`（执行处）

## 这一步做什么

两个改动：
1. **工具 execute 从 Promise 改 Effect**——这样工具内部能 `yield* FileSystem.Service` 取依赖
2. **ToolRegistry 从静态数组升级为可注册注册表**（register/list/get）

## 改动 1：工具 execute Effect 化

看 Tool 接口的变化：

```typescript
// 之前（阶段 3-15）
export interface Tool<Parameters extends Schema.Decoder<unknown>> {
  id: string
  description: string
  parameters: Parameters
  execute(args: Schema.Schema.Type<Parameters>): Promise<string>   // ← Promise
}

// 现在（阶段 16.4）
export interface Tool<
  Parameters extends Schema.Decoder<unknown> = Schema.Decoder<unknown>,
  R = never,                                   // ← 新增：这个工具需要哪些服务
> {
  id: string
  description: string
  parameters: Parameters
  execute(args: Schema.Schema.Type<Parameters>): Effect.Effect<string, never, R>  // ← Effect
}
```

**关键：为什么 execute 必须改 Effect？**
工具要用 FileSystem 服务，必须能"从 Context 取"——而取服务的语法是 `yield*`，
它只能在 Effect 函数体里用。Promise 函数体内没有 Context。

read 工具的 execute 改造：

```typescript
// 之前：直接 Bun.file
async function execute(args) {
  const file = Bun.file(filePath)
  const exists = await file.exists()
  const text = await file.text()
  // ...
}

// 现在：yield* FileSystem.Service
const execute = (args) =>
  Effect.gen(function* () {
    const fs = yield* FileSystemService       // ← 从 Context 取服务
    const text = yield* Effect.promise(() => fs.read(filePath))
    if (text === null) return `错误：文件 ${filePath} 不存在`
    // ...
  })

// 工具定义标注 R：这个工具需要 FileSystemService
export const readTool: Tool<typeof Parameters, FileSystemService> = {
  id: "read",
  description: DESCRIPTION,
  parameters: Parameters,
  execute,
}
```

**R 泛型的作用**：类型系统强制"执行 read 时 Context 里必须有 FileSystemService"。
如果 agent-loop 忘了 provide，编译就报错——不用等运行时才发现。

## 改动 2：ToolRegistry 升级

之前（阶段 11-12）是静态数组：

```typescript
ToolRegistry.of({
  list: () => [readTool, writeTool, editTool, bashTool, globTool, grepTool],
})
```

现在（阶段 16.4）是可注册注册表（对照 opencode `core/src/tool/registry.ts`）：

```typescript
export interface ToolRegistryApi {
  readonly register: (tool: Tool<any, any>) => void
  readonly list: () => Tool<any, any>[]
  readonly get: (id: string) => Tool<any, any> | undefined
}

export const toolRegistryLayer = Layer.effect(
  ToolRegistry,
  Effect.sync(() => {
    const tools = new Map<string, Tool<any, any>>()
    for (const tool of [readTool, writeTool, editTool, bashTool, globTool, grepTool]) {
      tools.set(tool.id, tool)
    }
    return ToolRegistry.of({
      register: (tool) => { tools.set(tool.id, tool) },
      list: () => Array.from(tools.values()),
      get: (id) => tools.get(id),
    })
  }),
)
```

**为什么用 `Tool<any, any>`？** 不同工具的参数 Schema 和服务需求（R）都不同，
注册表要能存"任意工具"，所以用宽松类型。代价是取出来时 R 会丢失（变 any）——
这个问题在 agent-loop 执行时要用一个技巧处理（见下）。

## ⚠️ 一个重要的坑：Effect.fn 的 R 会被 any 污染

工具 execute 从注册表取出来时是 `Tool<any, any>`，所以 `tool.execute(args)` 返回
`Effect<string, never, any>`——R 是 any。

**问题**：`Effect.gen` / `Effect.fn` 有个已知特性——**只要 generator 里 yield* 一个
R=any 的 Effect，整个 generator 的 R 就退化成 any**。

```
yield* Effect<string, never, any>   ← 这个会污染
→ 外层 Effect 的 R 变成 any
→ Effect.provide(appLayers) 时 tsc 报错：
   "Type 'any' is not assignable to type 'never'"
```

**解法**：在执行工具的 Effect 上，显式提供 FileSystem 服务 + 断言 R 已收窄：

```typescript
// agent-loop.ts 里
const fs = yield* FileSystemService    // 先拿 FileSystem 实例

const runTool = Effect.try({ try: () => JSON.parse(tc.function.arguments), ... })
  .pipe(
    Effect.flatMap((rawArgs) =>
      Schema.decodeUnknownEffect(tool.parameters)(rawArgs).pipe(
        Effect.mapError(...),
        Effect.flatMap((args) =>
          tool.execute(args).pipe(Effect.provideService(FileSystemService, fs)),
          // 运行时真正提供 FileSystem
        ),
      ),
    ),
    Effect.catch(...),
    // 关键：在这里（整个 runTool 的结果）断言 R 已是 never
    (effect) => effect as Effect.Effect<string, never, never>,
  )
output = yield* runTool
```

**为什么断言在"最外层"？** 中间步骤的 any 会污染 generator，所以要在 generator
实际 `yield*` 的那个 Effect（runTool）上把 R 清成 never——这样 generator 只看到一个
R=never 的 Effect，不会被污染。

这个坑体现了"宽松类型（any）和 Effect 类型推断"的冲突。opencode 在更早的层面
provide 完整 Context 来规避，我们这里是"执行时即时提供 + 收尾断言"。

## agent-loop 的调用处简化

之前（工具 execute 返回 Promise）：

```typescript
Effect.flatMap((args) => Effect.promise(() => tool.execute(args)))
```

现在（execute 返回 Effect）：

```typescript
Effect.flatMap((args) => tool.execute(args).pipe(Effect.provideService(FileSystemService, fs)))
```

少了一层 `Effect.promise` 包装——工具本身就是 Effect 了。

## 验证：第 4 步成功标志

```bash
bunx tsc --noEmit                              # 通过（agent-loop 的 R 收窄正确）
bun run packages/opencode/src/index.ts run "读 xxx 文件"
# read 工具正常（走 FileSystem 服务）
bun run packages/opencode/src/index.ts run "列出 package.json"
# glob 工具正常
```

## 工程思维：R 泛型 = 类型层面的"依赖声明"

工具的 `R` 泛型是很有价值的设计：它在**编译期**就声明了"这个工具依赖哪些服务"。
- 读代码时，`Tool<typeof Parameters, FileSystemService>` 一眼看出 read 需要 FileSystem
- 忘记 provide 时，编译器报错——依赖错误在编译期暴露

这就是 Effect 的"类型即文档"：依赖关系不只写在注释里，更写进了类型签名。

## 下一步

[16.5 第 5 步：Session 存储服务](../05-session-store/01-session-store.md)
——session + message 服务化，依赖 Database。
