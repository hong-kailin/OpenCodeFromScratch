// src/agent-loop.ts
// agent loop 的核心逻辑：LLM 调用工具 -> 执行 -> 喂回结果 -> 继续调 LLM
// 从 src/index.ts 的 runToolLoop 重构而来，用回调代替直接写 stdout
// 这样 CLI 版用 console 回调，TUI 版用 signal 回调，核心逻辑共用

import type { Message } from "./types"
import type { Provider } from "./provider"
import type { Tool } from "./tool/tool"
import { truncate } from "./tool/truncate"

// 回调接口：调用方决定怎么处理事件（打印到终端 / 更新 TUI signal / 存数据库）
export interface LoopCallbacks {
  // LLM 流式输出文本时调用（每收到一个 token 调一次）
  onChunk: (text: string) => void
  // LLM 决定调用工具时调用
  onToolCall: (name: string, args: string) => void
  // 工具执行完毕时调用
  onToolResult: (output: string) => void
}

export async function runAgentLoop(
  messages: Message[],
  provider: Provider,
  tools: Tool[],
  callbacks: LoopCallbacks,
): Promise<void> {
  const MAX_STEPS = 20

  let step = 0
  while (step < MAX_STEPS) {
    step++

    const result = await provider.chatWithTools(messages, tools, callbacks.onChunk)

    if (result.toolCalls.length === 0) {
      messages.push({ role: "assistant", content: result.text })
      break
    }

    messages.push({
      role: "assistant",
      content: result.text || null,
      tool_calls: result.toolCalls,
    })

    for (const tc of result.toolCalls) {
      const tool = tools.find((t) => t.id === tc.function.name)
      callbacks.onToolCall(tc.function.name, tc.function.arguments)

      let output: string
      if (!tool) {
        output = `错误：找不到工具 ${tc.function.name}`
      } else {
        const args = JSON.parse(tc.function.arguments)
        output = await tool.execute(args)
      }
      callbacks.onToolResult(output)

      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: truncate(output),
      })
    }
  }
}
