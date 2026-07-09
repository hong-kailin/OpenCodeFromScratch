// src/tui/agent.tsx
// 9.4 课教学代码：输入框 + 集成到 agent loop
// 跑法：bun run src/tui/agent.tsx
//
// 这个文件把前三课学的组合起来：
// - 9.1 SolidJS 响应式（createSignal）
// - 9.2 opentui 渲染（render、box、text）
// - 9.3 消息列表 + 流式文本
// 加上输入框（textarea），接到 agent loop 上，实现完整的 TUI agent

import { render, useKeyboard } from "@opentui/solid"
import { createSignal, For, Show } from "solid-js"
import type { TextareaRenderable } from "@opentui/core"
import { loadConfig } from "../llm"
import { createOpenAIProvider } from "../provider/openai"
import { readTool } from "../tool/read"
import { writeTool } from "../tool/write"
import { editTool } from "../tool/edit"
import { bashTool } from "../tool/bash"
import { globTool } from "../tool/glob"
import { grepTool } from "../tool/grep"
import { buildSystemPrompt } from "../system-context"
import { runAgentLoop } from "../agent-loop"
import type { Message } from "../types"

// TUI 用的消息结构（比内部 Message 简单，只关心显示）
interface ChatMessage {
  role: "user" | "assistant" | "tool"
  content: string
}

function App() {
  const [messages, setMessages] = createSignal<ChatMessage[]>([
    { role: "assistant", content: "你好！我是 AI 助手，有什么可以帮你的？" },
  ])
  const [loading, setLoading] = createSignal(false)

  // textarea 的 ref：opentui 的 textarea 不用 onInput/onSubmit
  // 而是用 ref 拿到 TextareaRenderable 对象，通过 .plainText 读内容、.setText() 清空
  let textarea: TextareaRenderable | undefined

  async function handleSubmit() {
    const text = textarea?.plainText?.trim()
    // 空消息或正在生成时不提交
    if (!text || loading()) return
    textarea?.setText("")
    setLoading(true)

    // 添加用户消息到 TUI
    setMessages((prev) => [...prev, { role: "user", content: text }])

    try {
      const config = await loadConfig()
      const provider = createOpenAIProvider(config)
      const tools = [readTool, writeTool, editTool, bashTool, globTool, grepTool]

      // 内部 messages 数组：发给 LLM 用的完整消息（含 system prompt）
      const internalMessages: Message[] = [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: text },
      ]

      // 跑 agent loop，用回调更新 TUI
      await runAgentLoop(internalMessages, provider, tools, {
        // 流式文本：收到 chunk 就追加到最后一条 assistant 消息
        // 如果最后一条不是 assistant（比如刚加完 user 消息），就新建一条
        onChunk(chunk) {
          setMessages((prev) => {
            const last = prev[prev.length - 1]!
            if (last.role !== "assistant") {
              return [...prev, { role: "assistant", content: chunk }]
            }
            return [
              ...prev.slice(0, -1),
              { ...last, content: last.content + chunk },
            ]
          })
        },
        // 工具调用：显示工具名和参数
        onToolCall(name, args) {
          setMessages((prev) => [
            ...prev,
            { role: "tool", content: `调用 ${name}(${args})` },
          ])
        },
        // 工具结果：显示前 200 字符
        onToolResult(output) {
          const preview = output.length > 200 ? output.slice(0, 200) + "..." : output
          setMessages((prev) => [
            ...prev,
            { role: "tool", content: `结果: ${preview}` },
          ])
        },
      })
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `错误: ${errorMsg}` },
      ])
    } finally {
      setLoading(false)
    }
  }

  // 全局键盘监听：Enter 提交
  // useKeyboard 是 opentui 提供的 hook，在组件渲染期间注册键盘事件
  // evt.name 是按键名：return、escape、a、b、c...
  useKeyboard((evt) => {
    if (evt.name === "return" && !loading()) {
      evt.preventDefault()
      handleSubmit()
    }
  })

  return (
    <box flexDirection="column" height="100%">
      {/* 标题栏 */}
      <box padding={1}>
        <text fg="green">AI 助手</text>
        <Show when={loading()}>
          <text fg="yellow"> (生成中...)</text>
        </Show>
      </box>

      {/* 消息列表：占满剩余空间，stickyScroll 自动滚到底部 */}
      <scrollbox flexGrow={1} stickyScroll={true}>
        <For each={messages()}>
          {(msg) => {
            const color = msg.role === "user" ? "cyan" : msg.role === "assistant" ? "green" : "gray"
            const label = msg.role === "user" ? "你" : msg.role === "assistant" ? "AI" : "🔧"
            return (
              <box paddingLeft={1} paddingTop={1}>
                <text fg={color}>{label}: </text>
                <text>{msg.content}</text>
              </box>
            )
          }}
        </For>
      </scrollbox>

      {/* 输入框 */}
      <box padding={1}>
        <textarea
          ref={(val: TextareaRenderable) => {
            textarea = val
            // 启动时自动聚焦到输入框
            queueMicrotask(() => val.focus())
          }}
          placeholder="输入消息... (Enter 发送)"
          minHeight={1}
          maxHeight={6}
        />
      </box>
    </box>
  )
}

render(() => <App />)
