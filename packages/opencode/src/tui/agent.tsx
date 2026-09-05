// src/tui/agent.tsx
// 阶段 12 教学代码：TUI 入口——从 Context 取依赖，跑 agent loop
// 跑法：bun run src/tui/agent.tsx
//
// 重构前（阶段 9）：
//   const config = await loadConfig()
//   const provider = createOpenAIProvider(config)
//   const tools = [readTool, writeTool, ...]
//   await runAgentLoop(internalMessages, provider, tools, callbacks)
//
// 重构后（阶段 12）：
//   provider 和 tools 从 Context 自取，只在入口组装一次 Layer
//   runAgentLoop 签名变短——不再传 provider/tools

import { render, useKeyboard } from "@opentui/solid"
import { createSignal, For, Show } from "solid-js"
import type { TextareaRenderable } from "@opentui/core"
import "opentui-spinner/solid"
import { Effect, Layer } from "effect"
import { buildSystemPrompt, configLayer, providerLayer, toolRegistryLayer, fileSystemLayer } from "@opencode-from-scratch/core"
import { runAgentLoop } from "../agent-loop"
import type { Message } from "@opencode-from-scratch/schema"

// Layer 组装：和 CLI 入口一样，providerLayer 依赖 ConfigService
// fileSystemLayer 也不能少——工具 execute 需要 FileSystem 服务（16.3）
const satisfiedProvider = providerLayer.pipe(Layer.provide(configLayer))
const appLayers = Layer.mergeAll(
  configLayer,
  satisfiedProvider,
  toolRegistryLayer,
  fileSystemLayer,
)

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

interface ChatMessage {
  role: "user" | "assistant" | "tool"
  content: string
  toolName?: string
  toolArgs?: string
  toolStatus?: "running" | "completed"
}

const RESULT_PREVIEW_LEN = 200

function App() {
  const [messages, setMessages] = createSignal<ChatMessage[]>([
    { role: "assistant", content: "你好！我是 AI 助手，有什么可以帮你的？" },
  ])
  const [loading, setLoading] = createSignal(false)
  let textarea: TextareaRenderable | undefined

  async function handleSubmit() {
    const text = textarea?.plainText?.trim()
    if (!text || loading()) return
    textarea?.setText("")
    setLoading(true)

    setMessages((prev) => [...prev, { role: "user", content: text }])

    try {
      const internalMessages: Message[] = [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: text },
      ]

      // 跑 agent loop，provider 和 tools 从 Context 自取
      // TUI 版不需要持久化，所以不传 onMessage
      await Effect.runPromise(
        runAgentLoop(internalMessages, {
          onChunk(chunk) {
            setMessages((prev) => {
              const last = prev[prev.length - 1]!
              if (last.role !== "assistant") {
                return [...prev, { role: "assistant", content: chunk }]
              }
              return [...prev.slice(0, -1), { ...last, content: last.content + chunk }]
            })
          },
          onToolCall(id, name, args) {
            setMessages((prev) => [
              ...prev,
              { role: "tool", content: "", toolName: name, toolArgs: args, toolStatus: "running" },
            ])
          },
          onToolResult(id, output) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.role === "tool" && msg.toolStatus === "running"
                  ? { ...msg, toolStatus: "completed", content: output }
                  : msg,
              ),
            )
          },
          // TUI 版不传 onMessage——不需要持久化
        }).pipe(Effect.provide(appLayers)),
      )
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      setMessages((prev) => [...prev, { role: "assistant", content: `错误: ${errorMsg}` }])
    } finally {
      setLoading(false)
    }
  }

  useKeyboard((evt) => {
    if (evt.name === "return" && !loading()) {
      evt.preventDefault()
      handleSubmit()
    }
  })

  return (
    <box flexDirection="column" height="100%">
      <box padding={1}>
        <text fg="green">AI 助手</text>
        <Show when={loading()}>
          <text fg="yellow"> (生成中...)</text>
        </Show>
      </box>

      <scrollbox flexGrow={1} stickyScroll={true}>
        <For each={messages()}>
          {(msg) => (
            <Show
              when={msg.role === "tool"}
              fallback={
                <box paddingLeft={1} paddingTop={1}>
                  <text fg={msg.role === "user" ? "cyan" : "green"}>
                    {msg.role === "user" ? "你" : "AI"}:{" "}
                  </text>
                  <text>{msg.content}</text>
                </box>
              }
            >
              <box paddingLeft={1} paddingTop={1} flexDirection="column">
                <Show
                  when={msg.toolStatus === "running"}
                  fallback={
                    <box flexDirection="row" gap={1}>
                      <text fg="green">✓</text>
                      <text fg="gray">{msg.toolName}({msg.toolArgs})</text>
                    </box>
                  }
                >
                  <box flexDirection="row" gap={1}>
                    <spinner frames={SPINNER_FRAMES} interval={80} />
                    <text fg="yellow">{msg.toolName}({msg.toolArgs})</text>
                  </box>
                </Show>
                <Show when={msg.toolStatus === "completed" && msg.content}>
                  <text fg="gray" paddingLeft={2}>
                    {msg.content.length > RESULT_PREVIEW_LEN
                      ? msg.content.slice(0, RESULT_PREVIEW_LEN) + "..."
                      : msg.content}
                  </text>
                </Show>
              </box>
            </Show>
          )}
        </For>
      </scrollbox>

      <box padding={1}>
        <textarea
          ref={(val: TextareaRenderable) => {
            textarea = val
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