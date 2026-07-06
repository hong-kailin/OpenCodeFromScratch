// src/provider/anthropic.ts
// Anthropic Messages API Provider 实现（参考代码，不运行）
//
// 这个文件是教学参考，展示 Anthropic API 和 OpenAI API 的格式差异。
// 我们没有 Anthropic API key，所以这段代码不运行。
// 像看 opencode 源码一样学习其中的格式转换逻辑。
//
// 对照 opencode: packages/llm/src/protocols/anthropic-messages.ts
// opencode 的实现有 500+ 行（Schema 校验、状态机、缓存控制等）
// 我们简化版只展示核心的格式转换

import type { Provider, ChatResult } from "../provider"
import type { Message, ToolCall } from "../types"
import type { Tool } from "../tool/tool"
import { toolToOpenAIFormat } from "../tool/tool"

// ── 请求格式转换 ──────────────────────────────────────────
// 把我们的 Message[]（OpenAI 格式）转成 Anthropic 的请求格式
// 对照 opencode: protocols/anthropic-messages.ts 的 fromRequest / lowerMessage

// Anthropic 的 content block 类型
type AnthropicTextBlock = { type: "text"; text: string }
type AnthropicToolUseBlock = { type: "tool_use"; id: string; name: string; input: unknown }
type AnthropicToolResultBlock = { type: "tool_result"; tool_use_id: string; content: string }
type AnthropicContentBlock = AnthropicTextBlock | AnthropicToolUseBlock | AnthropicToolResultBlock

// Anthropic 的消息格式（content 始终是数组）
interface AnthropicMessage {
  role: "user" | "assistant"
  content: AnthropicContentBlock[]
}

// 把 OpenAI 格式的 Message[] 转成 Anthropic 格式
// 返回 { system, messages }——system 是顶层字段
function convertMessages(messages: Message[]): { system: string; messages: AnthropicMessage[] } {
  // 1. 提取 system prompt（OpenAI 放在 messages 里，Anthropic 放顶层）
  const systemMsg = messages.find((m) => m.role === "system")
  const system = systemMsg?.content || ""

  // 2. 转换剩余消息
  const anthropicMessages: AnthropicMessage[] = []

  for (const msg of messages) {
    if (msg.role === "system") continue // system 已提取

    if (msg.role === "user") {
      // user 消息：content 字符串 → text block 数组
      anthropicMessages.push({
        role: "user",
        content: [{ type: "text", text: msg.content || "" }],
      })
    } else if (msg.role === "assistant") {
      // assistant 消息：可能有 text + tool_calls
      const blocks: AnthropicContentBlock[] = []

      // 文本内容
      if (msg.content) {
        blocks.push({ type: "text", text: msg.content })
      }

      // 工具调用：OpenAI 的 tool_calls → Anthropic 的 tool_use block
      // 关键区别：arguments 是 JSON 字符串 → input 是 JSON 对象
      if (msg.tool_calls) {
        for (const tc of msg.tool_calls) {
          blocks.push({
            type: "tool_use",
            id: tc.id,
            name: tc.function.name,
            input: JSON.parse(tc.function.arguments), // 字符串 → 对象
          })
        }
      }

      anthropicMessages.push({ role: "assistant", content: blocks })
    } else if (msg.role === "tool") {
      // tool 消息：OpenAI 用 role:"tool" → Anthropic 用 role:"user" + tool_result block
      // 关键区别：tool_call_id → tool_use_id，role 从 tool 变成 user
      anthropicMessages.push({
        role: "user", // ← 注意：Anthropic 把工具结果放在 user 消息里
        content: [
          {
            type: "tool_result",
            tool_use_id: msg.tool_call_id || "",
            content: msg.content || "",
          },
        ],
      })
    }
  }

  return { system, messages: anthropicMessages }
}

// 把 OpenAI 格式的 tool 定义转成 Anthropic 格式
// OpenAI: { type: "function", function: { name, description, parameters } }
// Anthropic: { name, description, input_schema }
function convertTools(tools: Tool[]) {
  const openaiFormat = tools.map(toolToOpenAIFormat)
  return openaiFormat.map((t) => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters, // parameters → input_schema
  }))
}

// ── Anthropic Provider 实现 ──────────────────────────────

export function createAnthropicProvider(config: {
  baseURL: string
  apiKey: string
  modelID: string
}): Provider {
  return {
    id: "anthropic",

    async chatWithTools(
      messages: Message[],
      tools: Tool[],
      onChunk: (text: string) => void,
    ): Promise<ChatResult> {
      // 1. 转换消息格式
      const { system, messages: anthropicMessages } = convertMessages(messages)
      const anthropicTools = convertTools(tools)

      // 2. 发请求
      // 注意和 OpenAI 的区别：
      // - 端点：/messages（不是 /chat/completions）
      // - 认证：x-api-key header + anthropic-version header（不是 Bearer token）
      // - 请求体：system 是顶层字段，max_tokens 必填
      const response = await fetch(`${config.baseURL}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": config.apiKey, // ← 不是 Authorization: Bearer
          "anthropic-version": "2023-06-01", // ← Anthropic 特有的版本 header
        },
        body: JSON.stringify({
          model: config.modelID,
          system, // ← 顶层字段，不在 messages 里
          messages: anthropicMessages,
          tools: anthropicTools,
          stream: true,
          max_tokens: 4096, // ← Anthropic 必填，OpenAI 可选
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Anthropic API 错误 ${response.status}: ${errorText}`)
      }

      // 3. 解析流式响应
      // Anthropic 流式有事件类型，不像 OpenAI 只有 choices[0].delta
      // 我们关心的事件：
      // - content_block_delta + text_delta：文本增量
      // - content_block_delta + input_json_delta：工具参数增量
      // - content_block_start + tool_use：工具调用开始（拿到 id 和 name）
      const decoder = new TextDecoder()
      let fullText = ""
      // 和 OpenAI Provider 一样，按 index 累积工具调用
      const toolCallsMap = new Map<number, { id: string; name: string; arguments: string }>()

      for await (const chunk of response.body!) {
        const text = decoder.decode(chunk, { stream: true })

        for (const line of text.split("\n")) {
          if (!line.startsWith("data: ")) continue

          const data = line.slice(6)
          if (data === "[DONE]") continue

          const event = JSON.parse(data)

          // 按事件类型处理
          switch (event.type) {
            // 文本增量
            case "content_block_delta":
              if (event.delta?.type === "text_delta") {
                onChunk(event.delta.text)
                fullText += event.delta.text
              } else if (event.delta?.type === "input_json_delta") {
                // 工具参数增量：和 OpenAI 的 arguments 拼接一样
                const existing = toolCallsMap.get(event.index)
                if (existing) {
                  existing.arguments += event.delta.partial_json
                }
              }
              break

            // 工具调用开始：拿到 id 和 name
            case "content_block_start":
              if (event.content_block?.type === "tool_use") {
                toolCallsMap.set(event.index, {
                  id: event.content_block.id,
                  name: event.content_block.name,
                  arguments: "", // 参数会在后续的 input_json_delta 里逐步到达
                })
              }
              break
          }
        }
      }

      // 4. 转换结果格式
      // Anthropic 的工具调用转回 OpenAI 格式：input 对象 → arguments 字符串
      const toolCalls: ToolCall[] = Array.from(toolCallsMap.values()).map((tc) => ({
        id: tc.id,
        type: "function" as const,
        function: {
          name: tc.name,
          arguments: tc.arguments, // 已经是 JSON 字符串了（拼接的 partial_json）
        },
      }))

      return { text: fullText, toolCalls }
    },
  }
}
