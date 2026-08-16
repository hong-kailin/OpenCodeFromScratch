// src/provider/openai.ts
// OpenAI 兼容 Provider 实现
// 从 llm.ts 的 chatWithTools 搬过来，包成 Provider 接口
// 对照 opencode: packages/llm/src/protocols/openai-chat.ts
// opencode 的 OpenAI Chat 协议实现有 500+ 行（Schema 校验、状态机解析等）
// 我们简化版直接 fetch + 手动解析 SSE

import type { Provider, ChatResult } from "../provider"
import type { Message, ToolCall } from "../types"
import type { Tool } from "../tool/tool"
import { toolToOpenAIFormat } from "../tool/tool"
import { debug } from "../debug"

// 创建 OpenAI 兼容 Provider
// config 由 loadConfig() 从 opencode.json 读取
// 对照 opencode: providers/openai.ts 的 configure() 函数
// opencode 的 configure 支持多种配置（auth、transport、headers 等），我们简化为 baseURL + apiKey + modelID
export function createOpenAIProvider(config: {
  baseURL: string
  apiKey: string
  modelID: string
}): Provider {
  return {
    id: "openai",

    async chatWithTools(
      messages: Message[],
      tools: Tool[],
      onChunk: (text: string) => void,
    ): Promise<ChatResult> {
      // 发流式请求（带 tools）
      // 调试：打印 API 请求详情（不打印 apiKey，安全考虑）
      debug("API 请求:")
      debug(`  POST ${config.baseURL}/chat/completions`)
      debug(`  model: ${config.modelID}`)
      debug(`  messages: ${messages.length} 条`)
      debug(`  tools: ${tools.map((t) => t.id).join(", ")}`)
      debug(`  stream: true`)

      const response = await fetch(`${config.baseURL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.modelID,
          stream: true,
          messages,
          tools: tools.map(toolToOpenAIFormat),
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        debug(`API 错误: ${response.status} ${response.statusText}`)
        debug(`  响应体: ${errorText}`)
        throw new Error(`API 错误 ${response.status}: ${errorText}`)
      }

      debug(`API 响应: ${response.status} ${response.statusText}`)
      debug("开始接收 SSE 流式数据...")

      const decoder = new TextDecoder()
      let fullText = ""

      // toolCallsMap：按 index 累积工具调用
      // 为什么用 Map？因为 LLM 可能同时调多个工具，用 index 区分（0, 1, 2...）
      // 每个 tool_call 的 arguments 是分块到达的，要拼接
      const toolCallsMap = new Map<number, { id: string; name: string; arguments: string }>()

      for await (const chunk of response.body!) {
        const text = decoder.decode(chunk, { stream: true })

        for (const line of text.split("\n")) {
          if (!line.startsWith("data: ")) continue

          const data = line.slice(6)
          if (data === "[DONE]") {
            debug("SSE: [DONE]")
            continue
          }

          const json = JSON.parse(data)
          const delta = json.choices[0]?.delta

          // 调试：打印每个 SSE delta 的关键信息
          if (delta?.content) {
            debug(`SSE delta: content="${delta.content}"`)
          }
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              if (tc.id) {
                debug(`SSE delta: tool_call 新建 index=${tc.index} id=${tc.id} name=${tc.function?.name}`)
              } else {
                debug(`SSE delta: tool_call 追加 index=${tc.index} args="${tc.function?.arguments}"`)
              }
            }
          }

          // 1. 处理文本增量
          const content = delta?.content
          if (content) {
            onChunk(content)
            fullText += content
          }

          // 2. 处理工具调用增量
          // tool_calls 的 arguments 是分块流式到达的：
          // 第一个 delta：有 id 和 name，arguments 是空字符串
          // 后续 delta：只有 arguments 的片段，要拼接
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const existing = toolCallsMap.get(tc.index)
              if (existing) {
                // 已有：拼接 arguments 片段
                if (tc.function?.arguments) existing.arguments += tc.function.arguments
              } else {
                // 新的：记录 id 和 name
                toolCallsMap.set(tc.index, {
                  id: tc.id,
                  name: tc.function?.name || "",
                  arguments: tc.function?.arguments || "",
                })
              }
            }
          }
        }
      }

      // 把 Map 转成数组
      const toolCalls: ToolCall[] = Array.from(toolCallsMap.values()).map((tc) => ({
        id: tc.id,
        type: "function" as const,
        function: {
          name: tc.name,
          arguments: tc.arguments,
        },
      }))

      debug(`SSE 流结束: 文本 ${fullText.length} 字符, ${toolCalls.length} 个工具调用`)

      return { text: fullText, toolCalls }
    },
  }
}
