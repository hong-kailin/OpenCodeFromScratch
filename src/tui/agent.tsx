// src/tui/agent.tsx
// 9.5 课教学代码：工具调用展示 + 阶段验收
// 跑法：bun run src/tui/agent.tsx
//
// 在 9.4 课基础上改进工具调用的显示：
// - 9.4：工具调用显示成两条独立消息（"调用 read(...)" + "结果: ..."），没有"执行中"状态
// - 9.5：把工具调用做成一个有状态的单体——执行中转 spinner 动画，完成后切换成 ✓ + 结果
//        对照 opencode 的 ToolPart 状态机（pending -> running -> completed）
//
// 关键改动：
// 1. ChatMessage 增加 tool 状态字段（toolName/toolArgs/toolStatus）
// 2. onToolCall/onToolResult 用 LLM 返回的 tool_call.id 关联"开始"和"完成"
// 3. 渲染时按 toolStatus 切换 spinner / 结果

import { render, useKeyboard } from "@opentui/solid"
import { createSignal, For, Show } from "solid-js"
import type { TextareaRenderable } from "@opentui/core"
import "opentui-spinner/solid" // 副作用导入：注册 <spinner> 自定义元素（对照 opencode 的 component/spinner.tsx）
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

// Braille 盲文字符的旋转动画帧，CLI spinner 的经典做法（对照 opencode 的 SPINNER_FRAMES）
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

// TUI 用的消息结构（比内部 Message 简单，只关心显示）
// 用可选字段而非联合类型：简化 TSX 里的类型收窄（教学简化，opencode 用严格的 discriminated union）
interface ChatMessage {
  role: "user" | "assistant" | "tool"
  content: string
  // 以下字段仅 role === "tool" 时使用
  // 工具名 + 参数（显示成 "read({"filePath":"..."})"）
  toolName?: string
  toolArgs?: string
  // 工具执行状态：running 时显示 spinner，completed 时显示 ✓ + 结果
  toolStatus?: "running" | "completed"
}

// 工具结果的预览长度（太长会撑爆终端，截断显示）
const RESULT_PREVIEW_LEN = 200

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
        // 工具开始调用：新增一条 status=running 的工具消息
        // id 来自 LLM 返回的 tool_call.id，等结果回来时用它找到这条记录更新
        onToolCall(id, name, args) {
          setMessages((prev) => [
            ...prev,
            {
              role: "tool",
              content: "",
              toolName: name,
              toolArgs: args,
              toolStatus: "running",
            },
          ])
        },
        // 工具执行完毕：用 id 找到刚才那条"执行中"的记录，更新为"已完成"并填入结果
        onToolResult(id, output) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.role === "tool" && msg.toolStatus === "running"
                ? { ...msg, toolStatus: "completed", content: output }
                : msg,
            ),
          )
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
          {(msg) => (
            // 用 <Show> 分流：工具消息走工具视图，其余走文本视图
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
              {/* 工具调用视图：执行中 -> spinner 动画；完成 -> ✓ + 结果预览 */}
              <box paddingLeft={1} paddingTop={1} flexDirection="column">
                <Show
                  when={msg.toolStatus === "running"}
                  fallback={
                    // 已完成：✓ + 工具名(参数)
                    <box flexDirection="row" gap={1}>
                      <text fg="green">✓</text>
                      <text fg="gray">
                        {msg.toolName}({msg.toolArgs})
                      </text>
                    </box>
                  }
                >
                  {/* 执行中：spinner 动画 + 工具名(参数) */}
                  <box flexDirection="row" gap={1}>
                    <spinner frames={SPINNER_FRAMES} interval={80} />
                    <text fg="yellow">
                      {msg.toolName}({msg.toolArgs})
                    </text>
                  </box>
                </Show>
                {/* 结果预览：完成时才显示，截断到 RESULT_PREVIEW_LEN 字符 */}
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
