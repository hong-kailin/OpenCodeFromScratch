# 12.1 重构 agent loop：签名瘦身

> 对照代码：`src/agent-loop.ts`、`src/agent-loop-demo.ts`

## 回顾：阶段 11 学到了什么

阶段 11 把 config、provider、tools 做成了 Service，注册到 Context 里。但 agent loop 还没用上——`runAgentLoop` 的签名还是 4 个参数。

```
重构前（阶段 9）：
  async function runAgentLoop(
    messages: Message[],
    provider: Provider,    ← 参数，手动传
    tools: Tool[],         ← 参数，手动传
    callbacks: LoopCallbacks,
  ): Promise<void>
```

现在阶段 11 已经把 provider 和 tools 做成 Service 了，那就让 loop 从 Context 自取——不再传参。

## 重构后

```typescript
export const runAgentLoop = Effect.fn("runAgentLoop")(function* (
  messages: Message[],
  callbacks: LoopCallbacks,   // 只剩两个参数！
) {
  const provider = yield* ProviderService   // 从 Context 取
  const tools = yield* ToolRegistry         // 从 Context 取
  const toolList = tools.list()
  // ...
})
```

变化：
1. **签名从 4 个参数 → 2 个参数**
2. **`async function` → `Effect.fn("Name")`**
3. **`provider.chatWithTools(...)` 用 `yield* Effect.promise(...)` 桥接**

## Effect.fn("Name") 是什么

```typescript
Effect.fn("runAgentLoop")(function* (...) { ... })
```

- `Effect.fn("名字")` 给函数加一个 trace 名——调试时 fiber trace 里能看到
- 返回的仍然是一个普通函数：调用 `runAgentLoop(messages, callbacks)` 得到 Effect
- 对照 opencode：每个重要函数都是这个模式，如 `Effect.fn("LLM.compile")`

## Effect.promise 桥接

`chatWithTools` 和 `tool.execute` 返回的是普通 Promise，在 Effect.gen 里不能直接 `await`：

```typescript
// gen 里不能写 await，要用 yield* + Effect.promise 桥接
const result = yield* Effect.promise(() =>
  provider.chatWithTools(messages, toolList, callbacks.onChunk),
)

// 工具执行也一样
const output = yield* Effect.promise(() => tool.execute(args))
```

## 签名瘦身的意义

```
加新依赖时：
  重构前：改签名 → 改所有调用方 → 改两处（index.ts + tui/agent.tsx）
  重构后：函数体里加一行 yield* NewService → 调用方不用改
```

这就是"依赖注入"的实战价值——函数不再知道依赖的细节，只声明"我需要什么"，由 Context 提供。

## 跑一下

```bash
bun run src/agent-loop-demo.ts
```

看 demo 输出中的签名对比部分。