// src/provider.ts
// Provider 接口：所有 LLM provider 都要实现这个接口
// 对照 opencode: packages/llm/src/route/client.ts 的 Route 接口
// opencode 的 Route 有四轴（Protocol + Endpoint + Auth + Framing），我们简化为一个方法

import type { Message, ToolCall } from "./types"
import type { Tool } from "./tool/tool"

// chatWithTools 的返回值
export interface ChatResult {
  text: string // LLM 回复的完整文本（可能为空，如果有 tool_calls）
  toolCalls: ToolCall[] // LLM 要调用的工具列表（可能为空）
}

// Provider 接口：agent 代码通过这个接口调用 LLM，不关心底下是 OpenAI 还是 Anthropic
// 对照 opencode: 它的 Route 接口有 prepareTransport、streamPrepared 等方法
// 我们简化为只有一个 chatWithTools 方法
export interface Provider {
  // provider 的唯一标识（如 "openai"、"anthropic"）
  id: string

  // 带 tool calling 的流式对话
  // 输入：messages 历史、tools 列表、onChunk 回调（流式输出文本）
  // 输出：完整文本 + tool calls
  chatWithTools(
    messages: Message[],
    tools: Tool[],
    onChunk: (text: string) => void,
  ): Promise<ChatResult>
}
