// src/tui/messages.tsx
// 9.3 课教学代码：消息列表渲染 + 流式文本
// 跑法：bun run src/tui/messages.tsx

import { render } from "@opentui/solid"
import { createSignal, For } from "solid-js"

interface ChatMessage {
  role: "user" | "assistant" | "tool"
  content: string
}

function App() {
  const [messages, setMessages] = createSignal<ChatMessage[]>([])

  // 模拟一段对话
  setTimeout(() => {
    // 1. 用户消息
    setMessages((prev) => [...prev, { role: "user", content: "帮我读一下 src/index.ts" }])
  }, 500)

  setTimeout(() => {
    // 2. 添加空的 assistant 消息，准备流式填充
    setMessages((prev) => [...prev, { role: "assistant", content: "" }])
  }, 1500)

  setTimeout(() => {
    // 模拟流式输出：逐字追加到 assistant 消息
    // 真实场景（9.4 课）换成 onChunk 回调，不需要 setInterval
    const text = "好的，我来读取这个文件。这个文件是项目的入口，包含 CLI 定义和 agent loop..."
    let i = 0
    const timer = setInterval(() => {
      if (i >= text.length) {
        clearInterval(timer)
        return
      }
      setMessages((prev) => {
        const updated = [...prev]
        const last = updated[updated.length - 1]!
        updated[updated.length - 1] = { ...last, content: last.content + text[i] }
        return updated
      })
      i++
    }, 50)
  }, 2000)

  setTimeout(() => {
    // 4. 再加一条用户消息
    setMessages((prev) => [...prev, { role: "user", content: "还有别的文件吗？" }])
  }, 6000)

  setTimeout(() => {
    // 5. 再加一条 assistant 回复
    setMessages((prev) => [...prev, { role: "assistant", content: "还有很多文件，比如 llm.ts、session.ts、message.ts 等。" }])
  }, 7000)

  return (
    <box flexDirection="column" height="100%">
      {/* 标题栏 */}
      <box padding={1}>
        <text fg="green">AI 助手</text>
      </box>

      {/* 消息列表：占满剩余空间，自动滚到底部 */}
      <scrollbox flexGrow={1} stickyScroll={true}>
        <For each={messages()}>
          {(msg) => {
            const color = msg.role === "user" ? "cyan" : msg.role === "assistant" ? "green" : "gray"
            const label = msg.role === "user" ? "你" : msg.role === "assistant" ? "AI" : "🔧 工具"

            return (
              <box paddingLeft={1} paddingTop={1}>
                <text fg={color}>{label}:</text>
                <text>{msg.content}</text>
              </box>
            )
          }}
        </For>
      </scrollbox>
    </box>
  )
}

render(() => <App />)