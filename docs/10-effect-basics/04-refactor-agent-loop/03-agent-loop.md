# 10.4 重构 agent loop：合并两个 loop + Effect.fn

> 第 3 个文件。前两节做好了 ProviderService 和 ToolRegistry，这节把它们用进 agent loop：合并两个重复的 loop，改成从 Context 取依赖，并引入 opencode 的标志性模式 Effect.fn。

## 现状：两个重复的 loop

10.4 之前，代码里有**两个几乎一样的工具循环**：

- `src/agent-loop.ts` 的 `runAgentLoop`（TUI 版）：纯回调，不持久化
- `src/index.ts` 的 `runToolLoop`（CLI 版）：带 `saveMessage` 持久化

唯一区别就是持久化。这违背了"不要重复"——修 bug 要改两处。重构方案：**合并成一个 `runAgentLoop`，持久化变成回调**。

看 `src/agent-loop.ts` 的改动：

```ts
export interface LoopCallbacks {
  onChunk: (text: string) => void
  onToolCall: (id: string, name: string, args: string) => void
  onToolResult: (id: string, output: string) => void
  onMessage?: (msg: Message) => void  // 10.4 新增：持久化钩子
}
```

`onMessage` 是新增的可选回调。每次 loop 往 messages 里加消息时调用它。CLI 版传 `saveMessage`（持久化），TUI 版不传（不需要）。两个 loop 就此合一。

## 新东西 1：签名变短了

重构前（10.3 课之前）：

```ts
async function runAgentLoop(messages, provider, tools, callbacks) { ... }
```

重构后：

```ts
export const runAgentLoop = Effect.fn("runAgentLoop")(function* (messages, callbacks) {
  // provider 和 tools 从 Context 取，不再传参
  const provider = yield* ProviderService
  const tools = yield* ToolRegistry
  const toolList = tools.list()
  ...
})
```

**这就是 10.1 课痛点 4（参数层层传）的最终解法。** `provider` 和 `tools` 不再是参数——函数自己从 Context 取。签名从 4 个参数缩到 2 个，而且**以后加新依赖也不用改签名**（比如阶段 13 要加 SessionStore，直接在函数体里 `yield* SessionStore` 就行，不用动调用方）。

## 新东西 2：Effect.fn("Name")

看这行最显眼的语法：

```ts
Effect.fn("runAgentLoop")(function* (messages, callbacks) { ... })
```

拆开看：
- `Effect.fn("runAgentLoop")`：给函数起一个 **trace 名**（"runAgentLoop"）
- `(...)`：后面跟的函数体（`function*`，generator）
- 整体返回一个**普通函数**：调用 `runAgentLoop(messages, callbacks)` 得到一个 Effect

为什么要 trace 名？opencode 每个重要函数都用它。好处：
1. **调试**：报错时 Effect 的 fiber trace 里能看到"runAgentLoop"这个名字，而不是一堆匿名 generator
2. **日志**：Effect 的日志系统能按名字过滤/追踪
3. **自文档**：看到 `Effect.fn("ToolRegistry.settle")` 就知道这是谁、干什么

对照 opencode：`opencode/packages/llm/src/route/client.ts` 里到处是这个模式：

```ts
const compile = Effect.fn("LLM.compile")(function* (request: LLMRequest) { ... })
const prepareWith = Effect.fn("LLMClient.prepare")(function* (request: LLMRequest) { ... })
```

## 新东西 3：Effect.promise 桥接非 Effect 代码

`provider.chatWithTools` 还是返回 Promise（上节说的"返回类型不变"）。在 Effect 的 generator 里不能直接 `await`，要桥接：

```ts
const result = yield* Effect.promise(() =>
  provider.chatWithTools(messages, toolList, callbacks.onChunk),
)
```

`Effect.promise` 接收一个返回 Promise 的函数，返回一个 Effect。`yield*` 等它完成，拆出结果。这是 10.2 课的"桥接已有代码"——旧的非 Effect 代码不用重写，包一层就能进 Effect 世界。

工具执行也一样：

```ts
output = yield* Effect.promise(() => tool.execute(args))
```

## 完整流程

```
runAgentLoop(messages, callbacks)   ← 普通函数，返回 Effect
  │
  ├─ yield* ProviderService          ← 从 Context 取 provider
  ├─ yield* ToolRegistry             ← 从 Context 取工具列表
  │
  └─ while 循环（和原来逻辑一样）：
       ├─ yield* Effect.promise(chatWithTools)   ← 调 LLM，桥接 Promise
       ├─ 无 tool_calls → 加 assistant 消息，break
       ├─ 有 tool_calls → 加 assistant 消息（带 tool_calls）
       ├─ 每个工具：onToolCall → Effect.promise(execute) → onToolResult → 加 tool 消息
       └─ 每次加消息都调 callbacks.onMessage?.(msg)  ← 持久化钩子
```

## 对比：重构前后

| | 重构前 | 重构后 |
|---|---|---|
| loop 数量 | 2 个（TUI/CLI 各一个） | 1 个 |
| 签名 | `(messages, provider, tools, callbacks)` | `(messages, callbacks)` |
| provider 来源 | 参数传 | `yield* ProviderService` |
| tools 来源 | 参数传 | `yield* ToolRegistry` |
| 持久化 | CLI 版硬编码 saveMessage | `onMessage` 回调 |
| 加新依赖 | 改签名 + 所有调用方 | 函数体里加一行 yield* |

## 小结

1. **合并两个 loop**：用 `onMessage` 回调承载持久化差异
2. **签名变短**：provider/tools 从 Context 自取，不再传参
3. **Effect.fn("Name")**：opencode 的标志性模式，给函数加 trace 名
4. **Effect.promise**：桥接非 Effect 代码（chatWithTools、tool.execute）

---

下一步：[入口组装 Layer：provide + mergeAll](./04-layer-assembly.md)
