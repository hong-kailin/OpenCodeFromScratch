# 16.7 SystemContext 服务：组装 system prompt

> 阶段 16 的地图见 [16.0 总览](../00-overview/01-overview.md)。
> 本课把最后一个模块级函数 `buildSystemPrompt()` 变成 SystemContext Service——
> 阶段 16 的"服务化"到此全部完成。

## 这一步做什么

`system-context.ts` 从模块级 `buildSystemPrompt(): string` 升级成
**SystemContext Service**：`build()` 返回完整的 system prompt，
环境信息 + AGENTS.md 的组装逻辑收进服务。

对照代码：`packages/core/src/system-context.ts`、入口 `index.ts` / `tui/agent.tsx`

## 之前的问题

`buildSystemPrompt` 是模块级函数，直接读 `process.cwd()`、`readFileSync`：

```typescript
// index.ts
content: buildSystemPrompt()
```

问题（和 16.2/16.6 一样的老三样）：
1. **无法替换实现**——测试想控制"环境信息"或"AGENTS.md"很麻烦
2. **没有服务边界**——谁需要 prompt 就直接 import 函数
3. 和其他 6 个服务不一致——别人都是 Service，就它还是裸函数

## 解法：SystemContext Service

```typescript
// packages/core/src/system-context.ts
export interface SystemContextApi {
  readonly build: () => Effect.Effect<string>   // 返回完整 system prompt
}

export class SystemContext extends Context.Service<SystemContext, SystemContextApi>()(
  "opencode-from-scratch/SystemContext",
) {}

export const systemContextLayer = Layer.effect(
  SystemContext,
  Effect.sync(() =>
    SystemContext.of({
      build: Effect.fn("SystemContext.build")(function* () {
        const role = "你是一个编程助手，用中文回答。你可以使用 read、write、edit、bash、glob、grep 工具……"
        const env = buildEnvironmentInfo()      // 环境信息（内部函数）
        const instructions = loadInstructions() // AGENTS.md 加载（内部函数）
        // 拼接：角色 + 环境 + AGENTS.md 指令
        return [role, env, instructions].filter(Boolean).join("\n\n")
      }),
    }),
  ),
)
```

**内部函数不导出**（buildEnvironmentInfo / findAgentsMd / loadInstructions 留在
模块内部）——组装细节被服务封装，外部只能看到 `build()` 一个入口。

**为什么 build() 返回 Effect 而不是裸 string？** 现在内部是同步 fs
（readFileSync），用 `Effect.sync` 包即可。但返回 Effect 为未来留了余地——
如果后续某个系统提示组件需要异步加载（比如读远程配置），build() 的签名不用变。

> 对照 opencode：它的 system prompt 有 7 个组件（base + env + instructions +
> mcp + skills + structured + user），用 **registry 模式**——每个组件是一个
> 可注册的模块，load 时合并。我们只有 3 个组件，先简化成单个 Service，
> 组件多了再演进成 registry。

## CLI / TUI 改造：yield* SystemContext

两个入口的改动一样：

```typescript
// index.ts —— handler 里
const sysCtx = yield* SystemContext          // 取服务
const systemPromptContent = yield* sysCtx.build()  // 组装 prompt
const systemPrompt: Message = { role: "system", content: systemPromptContent }

// tui/agent.tsx —— handleSubmit 里
const sysCtx = yield* SystemContext
const systemPromptContent = yield* sysCtx.build()
```

入口 Layer 组装加一行：

```typescript
const appLayers = Layer.mergeAll(
  // ...
  systemContextLayer,   // 新增
  // ...
)
```

TUI 的 handleSubmit 顺便重构了：之前是"外面算好 internalMessages 再调
runAgentLoop"，现在整个逻辑包进 `Effect.gen`，从 Context 自取 SystemContext
和 agent loop 的依赖，更统一。

## 教 debug

**场景**：修改 AGENTS.md 后下一轮对话没生效。

排查：SystemContext 的 build() **每次调用都重新组装**（读文件是实时的），
不会缓存。如果没生效，确认入口每轮都调用了 `sysCtx.build()` 而不是缓存了
一次的结果。注意：CLI 里 systemPrompt 是在 handler 开头组装一次的——
每轮对话共享同一个 systemPrompt 消息（这是 opencode 的设计，不是 bug）。

**场景**：typecheck 报 SystemContext 服务未提供。

排查：入口 appLayers 的 mergeAll 漏了 `systemContextLayer`。检查两个入口。

## 验证：这一步成功标志

```bash
bunx tsc --noEmit
bun run packages/opencode/src/index.ts run "用read工具读一下AGENTS.md的第一行"
# 期望：LLM 正常调用 read 工具——说明 prompt 里加载了 AGENTS.md 指令
bun run packages/opencode/src/tui/hello.tsx   # TUI 渲染正常（3 秒无报错）
```

## 阶段 16 服务化到此全部完成

现在 core 包的 7 个服务齐了：

| 服务 | 步骤 | 能力 |
|------|------|------|
| Database | 16.2 | 提供 db 实例 |
| FileSystem | 16.3 | read/exists/write/glob/grep |
| ToolRegistry | 16.5 | register/list/get |
| SessionStore | 16.6 | session CRUD + message 存取 |
| SystemContext | 16.7 | 组装 system prompt |
| ConfigService | 阶段 11 | 读配置 |
| ProviderService | 阶段 11 | 调 LLM |

## 对照 opencode

| 我们 | opencode |
|------|----------|
| `SystemContext`（单个服务，3 组件） | `core/src/system-context/`（registry，7+ 组件） |
| `build()` 同步组装 | load 时组件可异步 |
| 简化：没有 mcp/skills 组件 | base+env+instructions+mcp+skills+structured+user |

## 小结

第 7 步做完：
- SystemContext 服务成立，最后一个模块级函数退役
- 7 个服务全部服务化——阶段 16 的核心工作完成
- 下一步只剩"上层接入 + 验收"

## 下一步

[16.8 上层接入 + 验收](../08-integration/01-integration.md)
——全盘检查 CLI/TUI 是否都走服务、删掉所有兼容层、验收功能与阶段 15 一致。
