# 9.4 输入框 + 集成到 agent

> 本课目标：用 `<textarea>` 做输入框，把 agent loop 接到 TUI 上，实现完整的终端 AI 助手。

## 要做什么

前三课分别学了 SolidJS 响应式、opentui 渲染、消息列表。这课把它们组合起来：

```
┌──────────────────────────────────────────┐
│ AI 助手                                   │
│                                          │
│ AI: 你好！我是 AI 助手...                  │
│ 你: 帮我读一下 src/index.ts               │
│ AI: 好的，我来读取...                     │
│ 🔧 调用 read({"filePath":"src/index.ts"}) │
│ 🔧 结果: // src/index.ts...              │
│ AI: 这个文件是项目的入口...               │
│                                          │
│ [输入消息... (Enter 发送)]                │
└──────────────────────────────────────────┘
```

跑法：

```bash
bun run src/tui/agent.tsx
```

## 关键问题：怎么把 async agent loop 接到 TUI？

这是本课的核心难点。

**agent loop 是 async 的**：调用 LLM 要等几秒，执行工具也要等。  
**TUI 渲染是同步的**：SolidJS 的 signal 一变就重渲染。

怎么让 async 的 loop 通知 TUI 更新？**回调**。

```
agent loop (async)                    TUI (SolidJS signal)
    │                                       │
    │── onChunk("你") ──────────────────────> setMessages(追加字符)
    │── onChunk("好") ──────────────────────> setMessages(追加字符)
    │── onToolCall("read", ...) ───────────> setMessages(加工具消息)
    │── onToolResult("文件内容...") ────────> setMessages(加结果消息)
    │── onChunk("这个文件...") ─────────────> setMessages(追加字符)
    │                                       │
    ▼                                       ▼
  循环结束                              UI 自动更新
```

loop 不关心怎么显示，只负责喊"我收到一段文本""我调了个工具"。TUI 听到回调就更新 signal，SolidJS 自动重渲染。

## 重构：从 stdout 到回调

### 之前（src/index.ts）

`runToolLoop` 直接写终端：

```ts
const result = await provider.chatWithTools(messages, tools, (text) => {
  process.stdout.write(text)  // 直接写 stdout
})
console.log(`  [调用工具] ${tc.function.name}(...)`)
```

问题：输出方式写死了，TUI 没法用。

### 现在（src/agent-loop.ts）

提取出 `runAgentLoop`，用回调代替直接写：

```ts
export interface LoopCallbacks {
  onChunk: (text: string) => void
  onToolCall: (name: string, args: string) => void
  onToolResult: (output: string) => void
}

export async function runAgentLoop(
  messages: Message[],
  provider: Provider,
  tools: Tool[],
  callbacks: LoopCallbacks,
): Promise<void> {
  // ...
  const result = await provider.chatWithTools(messages, tools, callbacks.onChunk)
  // ...
  callbacks.onToolCall(tc.function.name, tc.function.arguments)
  // ...
  callbacks.onToolResult(output)
}
```

loop 不关心 `onChunk` 里是 `process.stdout.write` 还是 `setMessages`，只管调。调用方决定怎么处理。

这就是**依赖注入**的思想：把"怎么输出"这个决策从 loop 内部移到外部，loop 只负责"什么时候该输出"。

## 输入框：textarea

opentui 的 `<textarea>` 和 Web 的不太一样：

```tsx
let textarea: TextareaRenderable | undefined

<textarea
  ref={(val: TextareaRenderable) => {
    textarea = val                    // 用 ref 拿到对象
    queueMicrotask(() => val.focus()) // 启动时聚焦
  }}
  placeholder="输入消息..."
  minHeight={1}
  maxHeight={6}
/>
```

关键区别：

| | Web textarea | opentui textarea |
|---|---|---|
| 读内容 | `e.target.value` | `textarea.plainText` |
| 清空 | `setValue("")` | `textarea.setText("")` |
| 提交 | `onSubmit` / `onKeyPress` | `useKeyboard` + ref |

opentui 的 textarea 没有 `onInput`/`onSubmit` 事件。读内容要直接访问 `textarea.plainText`，提交要全局监听键盘。

### 提交：useKeyboard

```tsx
import { useKeyboard } from "@opentui/solid"

useKeyboard((evt) => {
  if (evt.name === "return" && !loading()) {
    evt.preventDefault()
    handleSubmit()
  }
})
```

`useKeyboard` 是 opentui 的 hook，在组件内注册全局键盘监听。`evt.name` 是按键名：`return`、`escape`、`a`、`b`...。

对照 Python：像 `curses` 的 `getch()` + 事件分发，但用回调风格。

## 流式文本：onChunk 更新 signal

最精妙的部分在 `onChunk` 回调里：

```tsx
onChunk(chunk) {
  setMessages((prev) => {
    const last = prev[prev.length - 1]!
    // 如果最后一条不是 assistant（比如刚加完 user 消息），新建一条
    if (last.role !== "assistant") {
      return [...prev, { role: "assistant", content: chunk }]
    }
    // 如果最后一条已经是 assistant，追加内容
    return [
      ...prev.slice(0, -1),
      { ...last, content: last.content + chunk },
    ]
  })
}
```

### `onChunk(chunk) { ... }` 是什么语法？

你可能会疑惑：`onChunk(chunk)` 前面没有 `function` 关键字，这到底是不是函数定义？

是函数，但更准确说是**对象方法的简写**。这段代码是 `runAgentLoop` 的第 4 个参数--一个对象字面量，里面定义了三个方法：

```ts
await runAgentLoop(internalMessages, provider, tools, {
  onChunk(chunk) {         // ← 方法简写
    // ...
  },
  onToolCall(name, args) { // ← 方法简写
    // ...
  },
  onToolResult(output) {   // ← 方法简写
    // ...
  },
})
```

`onChunk(chunk) { ... }` 是 ES6 方法简写，完全等价于：

```ts
onChunk: function(chunk) { ... }
```

这个对象的形状要匹配 `LoopCallbacks` 接口（`agent-loop.ts` 里定义的）--必须有 `onChunk`、`onToolCall`、`onToolResult` 三个方法，参数类型也得对上。TypeScript 编译器会帮你检查。

用 Python 类比，相当于传一个带回调方法的类实例：

```python
# Python 的等价写法（概念上）
class LoopCallbacks:
    def on_chunk(self, chunk: str):
        ...
    def on_tool_call(self, name: str, args: str):
        ...
    def on_tool_result(self, output: str):
        ...

run_agent_loop(messages, provider, tools, LoopCallbacks())
```

TypeScript 把它压缩成了内联对象，不用单独定义一个 class。

为什么这么写？因为 agent loop 可能跑多轮：

1. **第一轮**：LLM 先输出文本 -> `onChunk` 被调用 -> 最后一条是 user 消息 -> 新建 assistant 消息
2. **LLM 调工具** -> `onToolCall`/`onToolResult` 添加 tool 消息
3. **第二轮**：LLM 基于工具结果继续输出 -> `onChunk` 被调用 -> 最后一条是 tool 消息 -> 又新建 assistant 消息

所以不能假设 `onChunk` 一定追加到同一条消息。判断"最后一条是不是 assistant"才能正确处理多轮。

## 两套 messages 的区别

这个文件里有**两个** `messages`，容易混淆：

| | 内部 `internalMessages` | TUI `messages` signal |
|---|---|---|
| 类型 | `Message[]`（含 system、tool_calls 等完整字段） | `ChatMessage[]`（只有 role + content） |
| 用途 | 发给 LLM 的完整上下文 | 显示在屏幕上 |
| 谁更新 | `runAgentLoop` 内部 push | 回调里 `setMessages` |

为什么要两套？因为给 LLM 的消息需要 `tool_calls`、`tool_call_id` 等字段，但显示在 TUI 上只需要文本。分离关注点：内部数组管 LLM 上下文，TUI signal 管显示。

## 完整代码

看 `src/tui/agent.tsx` + `src/agent-loop.ts`。

## 对照 opencode

opencode 的架构更复杂，但核心思路一样：

```
opencode 的集成方式：
  TUI (SolidJS)  ←→  Server (HTTP/SSE)  ←→  Agent (Effect Stream)
                       ↑ 事件流

我们的方式：
  TUI (SolidJS)  ←→  Agent Loop (async + 回调)
                       ↑ 直接调用
```

- opencode 的 TUI 和 agent 是**两个进程**，通过 HTTP + Server-Sent Events 通信。agent 把事件流推给 server，server 转发给 TUI
- 我们是**单进程**，agent loop 直接在 TUI 进程里跑，用回调更新 signal

opencode 的输入框在 `packages/tui/src/component/prompt/index.tsx`，核心也是 `<textarea>` + `ref` + 全局快捷键，但它用 `useBindings`（封装了 `@opentui/keymap`）而不是直接 `useKeyboard`，因为 opencode 有完整的 keymap 系统（可配置快捷键）。

## 本课小结

1. **回调解耦**：`runAgentLoop` 用回调代替直接写 stdout，CLI 和 TUI 各自实现回调
2. **textarea + ref**：opentui 的 textarea 通过 `ref` 拿到 `TextareaRenderable`，读 `plainText`，用 `useKeyboard` 监听 Enter
3. **onChunk 更新 signal**：判断最后一条消息是不是 assistant，决定新建还是追加
4. **两套 messages**：内部 `Message[]` 给 LLM，TUI `ChatMessage[]` 给显示

补充阅读：
- [回调函数详解](./03-callbacks.md) -- 如果觉得回调一层套一层看不懂，这篇从 Python 经验出发逐层拆解
- [如何在 VSCode 里 debug opentui TUI](./02-debug-tui.md) -- 交互式 TUI 的断点调试方法

下一步：[9.5 工具调用展示 + 阶段验收](../05-tool-display-review/) -- 优化工具调用的显示样式，回顾整个 TUI 阶段。