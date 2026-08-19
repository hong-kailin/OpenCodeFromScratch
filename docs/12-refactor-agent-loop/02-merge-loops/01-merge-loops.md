# 12.2 合并 CLI + TUI 双 loop

> 对照代码：`src/index.ts`、`src/tui/agent.tsx`、`src/agent-loop-demo.ts`

## 两个 loop 的问题

重构前，CLI 和 TUI 各有一个 loop：

```
src/index.ts 里的 runToolLoop：
  - 硬编码 process.stdout.write（流式输出）
  - 硬编码 console.log（工具调用）
  - 内部调 saveMessage（持久化）

src/agent-loop.ts 里的 runAgentLoop：
  - 用回调（onChunk/onToolCall/onToolResult）
  - 不持久化

唯一区别：持久化方式不同。
```

两个 loop 逻辑几乎一样——修 bug 要改两处，违背"不重复"原则。

## 解法：onMessage 回调

在 `LoopCallbacks` 里加一个可选回调 `onMessage`：

```typescript
export interface LoopCallbacks {
  onChunk: (text: string) => void
  onToolCall: (id: string, name: string, args: string) => void
  onToolResult: (id: string, output: string) => void
  onMessage?: (msg: Message) => void  // 新增：持久化钩子
}
```

loop 里每次往 messages 加消息时调用它：

```typescript
messages.push(assistantMsg)
callbacks.onMessage?.(assistantMsg)  // 可选调用——有就执行，没有就跳过
```

## CLI 版 vs TUI 版

```
CLI 版（需要持久化）：
  runAgentLoop(messages, {
    onChunk: (text) => process.stdout.write(text),
    onToolCall: (id, name, args) => console.log(...),
    onToolResult: () => {},
    onMessage: (msg) => saveMessage(sessionId, msg),  // ← 持久化
  })

TUI 版（不持久化）：
  runAgentLoop(messages, {
    onChunk: (chunk) => setMessages(...),
    onToolCall: (id, name, args) => setMessages(...),
    onToolResult: (id, output) => setMessages(...),
    // 不传 onMessage——不持久化
  })
```

**同一个 `runAgentLoop`，两个入口，只是回调不同。**

## 入口的 Layer 组装

两个入口都需要在 run 之前装配 Layer：

```typescript
// 两个入口完全一样的组装代码
const satisfiedProvider = providerLayer.pipe(Layer.provide(configLayer))
const appLayers = Layer.mergeAll(configLayer, satisfiedProvider, toolRegistryLayer)

// CLI 入口
await Effect.runPromise(
  runAgentLoop(messages, callbacks).pipe(Effect.provide(appLayers)),
)

// TUI 入口（完全一样的格式）
await Effect.runPromise(
  runAgentLoop(messages, callbacks).pipe(Effect.provide(appLayers)),
)
```

## 跑一下

```bash
bun run src/agent-loop-demo.ts
```

看 CLI 版和 TUI 版的对比，以及持久化消息数（6条 = 3条 assistant + 3条 tool）。