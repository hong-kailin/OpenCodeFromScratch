# 9.3 消息流渲染：列表 + 流式文本

> 本课目标：渲染一个消息列表，不同角色不同样式，支持流式文本（逐字显示）。

## 要做什么

把之前的 `console.log` + `process.stdout.write` 的文本输出，换成 TUI 里的消息列表：

```
┌──────────────────────────────────────────┐
│ 你: 帮我读一下 src/index.ts              │  ← user 消息（青色）
│                                          │
│ AI: 好的，我来读取这个文件...             │  ← assistant 消息（绿色）
│                                          │
│ 🔧 调用工具: read                       │  ← tool 消息（灰色）
│    src/index.ts                          │
└──────────────────────────────────────────┘
```

每条消息按角色显示不同颜色和前缀。新的 assistant 消息逐字显示（流式）。

## 代码

代码在 `src/tui/messages.tsx`。跑法：

```bash
bun run src/tui/messages.tsx
```

### 数据结构

用 `createSignal` 存消息数组，每条消息有 `role` 和 `content`：

```tsx
interface ChatMessage {
  role: "user" | "assistant" | "tool"
  content: string
}

const [messages, setMessages] = createSignal<ChatMessage[]>([])
```

### 消息列表组件

`<For>` 遍历消息数组，根据 `role` 选不同样式：

```tsx
<For each={messages()}>
  {(msg) => (
    <box paddingLeft={1} paddingTop={1}>
      {/* 角色标签：不同颜色 */}
      <text fg={msg.role === "user" ? "cyan" : msg.role === "assistant" ? "green" : "gray"}>
        {msg.role === "user" ? "你" : msg.role === "assistant" ? "AI" : "🔧 工具"}
      </text>
      {/* 消息内容 */}
      <text>{msg.content}</text>
    </box>
  )}
</For>
```

### 流式文本：原理

流式效果的本质是：**每次追加内容到 `content` 字段 → `setMessages` 触发重渲染 → 屏幕上多出几个字**。

本课用 `setInterval` 逐字追加来模拟，因为还没接 LLM。在 9.4 课集成 agent 后，实际数据来源是 LLM 的 `onChunk` 回调：

```tsx
// 真实场景（9.4 课）：每次收到一个 token 就追加，不需要 setInterval
const onChunk = (chunk: string) => {
  setMessages((prev) => {
    const updated = [...prev]
    const last = updated[updated.length - 1]!
    updated[updated.length - 1] = { ...last, content: last.content + chunk }
    return updated
  })
}
```

原理一样，只是数据来源从"定时器"换成"LLM 流式回调"。以下用 `setInterval` 做演示，方便跑起来看效果：

```tsx
// 1. 添加一个空的 assistant 消息
setMessages((prev) => [...prev, { role: "assistant", content: "" }])

// 2. 逐字追加（模拟流式，9.4 课换成 onChunk 回调）
const text = "好的，我来读取这个文件..."
let i = 0
const timer = setInterval(() => {
  if (i >= text.length) {
    clearInterval(timer)
    return
  }
  // 更新最后一条消息的 content：追加一个字符
  setMessages((prev) => {
    const updated = [...prev]
    const last = updated[updated.length - 1]!
    updated[updated.length - 1] = { ...last, content: last.content + text[i] }
    return updated
  })
  i++
}, 50) // 每 50ms 加一个字
```

关键：每次 `setMessages` 都会触发 SolidJS 重新渲染 `<For>` 里的对应元素。`content` 变长 → `<text>` 自动更新 → opentui 重绘 → 用户看到逐字输出。

### 完整代码

看 `src/tui/messages.tsx`。要点：
1. `<scrollbox stickyScroll>` 包裹消息列表，新消息自动滚到底部
2. `<For each={messages()}>` 遍历渲染
3. `setMessages` 更新数组 → SolidJS 自动重新渲染
4. 流式效果 = 逐字追加到 `content` 字段

## 对照 opencode

opencode 的消息渲染在 `packages/tui/src/routes/session/index.tsx`：

```tsx
// opencode 的消息列表（简化）
const messages = createMemo(() => sync.data.message[route.sessionID] ?? [])

<scrollbox stickyScroll={true} flexGrow={1}>
  <For each={messages()}>
    {(message) => (
      <Switch>
        <Match when={message.role === "user"}>
          <UserMessage message={message} parts={...} />
        </Match>
        <Match when={message.role === "assistant"}>
          <AssistantMessage message={message} parts={...} />
        </Match>
      </Switch>
    )}
  </For>
</scrollbox>
```

区别：
- opencode 用 `<Switch>/<Match>` 做条件渲染，我们用三元表达式（更简单）
- opencode 的消息分 `message` + `part` 两表，我们用单表
- opencode 的流式文本通过 `message.part.delta` 事件更新 `createStore`，我们直接 `setMessages`

原理一样：**数据变了 → 响应式更新 → opentui 重绘**。

## 本课小结

1. **`<For each={messages()}>`**：遍历消息数组，每条渲染一个元素
2. **角色样式**：user（青色）、assistant（绿色）、tool（灰色）
3. **流式文本**：逐字追加到 `content` 字段 → `setMessages` → SolidJS 自动重渲染
4. **`<scrollbox stickyScroll>`**：新消息自动滚到底部

下一步：[9.4 输入框 + 集成到 agent](../04-input-agent/) —— 替换 prompt()，用 `<textarea>` 输入，接到 agent loop 上。