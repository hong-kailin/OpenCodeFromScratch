// src/provider/openai.ts
// OpenAI 兼容 Provider 实现
// 从 llm.ts 的 chatWithTools 搬过来，包成 Provider 接口
// 对照 opencode: packages/llm/src/protocols/openai-chat.ts
// opencode 的 OpenAI Chat 协议实现有 500+ 行（Schema 校验、状态机解析等）
// 我们简化版直接 fetch + SSE 流式解析
//
// 阶段 14 改动：SSE 解析从"命令式 for await 循环"改成"Effect Stream 管线"
// 之前：for await (const chunk of response.body!) { ... } 两层循环，逻辑混在一起
// 阶段 17.1 再把字节分帧抽成 sseFraming，修复 SSE 事件跨网络 chunk 时被拆坏的问题
// 阶段 17.2 把 URL 构造抽成 Endpoint，Provider 不再手写 baseURL + path
// 对外接口不变（chatWithTools 签名一样），agent-loop / CLI / TUI 都不用动

import { Effect, Stream } from "effect"
import type { Provider, ChatResult } from "./interface"
import type { Message, ToolCall } from "@opencode-from-scratch/schema"
import type { Tool } from "../tool/tool"
import { toolToOpenAIFormat } from "../tool/tool"
import { LLMError } from "../error/errors"
import { debug } from "../debug"
import { sseFraming } from "./framing"
import type { Endpoint } from "./endpoint"
import { renderEndpoint } from "./endpoint"

// 创建 OpenAI 兼容 Provider
// config 由 loadConfig() 从 opencode.json 读取
// 对照 opencode: providers/openai.ts 的 configure() 函数
// opencode 的 configure 支持多种配置（auth、transport、headers 等），我们简化为 baseURL + apiKey + modelID
export function createOpenAIProvider(config: {
  baseURL: string
  apiKey: string
  modelID: string
}): Provider {
  // baseURL 来自用户配置；path 属于当前 OpenAI Chat 调用路线。
  // 两者先组成 Endpoint，真正发请求时再统一渲染成 URL。
  const endpoint: Endpoint = {
    baseURL: config.baseURL,
    path: "/chat/completions",
  }

  return {
    id: "openai",

    async chatWithTools(
      messages: Message[],
      tools: Tool[],
      onChunk: (text: string) => void,
    ): Promise<ChatResult> {
      // 发流式请求（带 tools）
      // 调试：打印 API 请求详情（不打印 apiKey，安全考虑）
      const url = renderEndpoint(endpoint)

      debug("API 请求:")
      debug(`  POST ${url.toString()}`)
      debug(`  model: ${config.modelID}`)
      debug(`  messages: ${messages.length} 条`)
      debug(`  tools: ${tools.map((t) => t.id).join(", ")}`)
      debug(`  stream: true`)

      const response = await fetch(url, {
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
        // 用 LLMError（typed error，阶段 13）——调用方能 catchTag("LLMError") 精确捕获
        // 之前是 throw new Error("字符串")，无法精确区分错误类型
        throw new LLMError({ message: `API 错误 ${response.status}: ${errorText}` })
      }

      debug(`API 响应: ${response.status} ${response.statusText}`)
      debug("开始接收 SSE 流式数据...")

      if (!response.body) {
        throw new LLMError({ message: "API 响应没有 body" })
      }

      // ═══════════════════════════════════════════════════════════
      // SSE 解析：Framing + 当前 OpenAI 协议解析
      // ═══════════════════════════════════════════════════════════
      // response.body 是 ReadableStream<Uint8Array>，也是异步可迭代对象
      // （AsyncIterable），所以能直接用 Stream.fromAsyncIterable 接进来。
      //
      // 阶段 17.1 把管线分成了两层：
      //
      // Framing 只判断事件边界：
      //   1. fromAsyncIterable  字节流 → Stream<Uint8Array>
      //   2. sseFraming         字节流 → 完整 data payload
      //
      // 当前 Provider 暂时继续承担 Protocol 的工作：
      //   3. JSON.parse         payload → OpenAI 事件对象
      //
      // 旧代码对每个网络 chunk 直接 split("\n")，没有保存块末尾的半行。
      // sseFraming 会跨 chunk 缓冲，只有收到 SSE 空行边界才输出完整 payload。
      const byteStream = Stream.fromAsyncIterable(
        response.body,
        (cause) => new LLMError({ message: `读取流失败: ${String(cause)}` }),
      )
      const sseDeltaStream = sseFraming.frame(byteStream).pipe(
        Stream.map((data) => JSON.parse(data)),
      )

      // 累积状态：完整文本 + 工具调用（按 index 累积，arguments 分块拼接）
      // 为什么用 Map？因为 LLM 可能同时调多个工具，用 index 区分（0, 1, 2...）
      // 每个 tool_call 的 arguments 是分块到达的，要拼接
      let fullText = ""
      const toolCallsMap = new Map<number, { id: string; name: string; arguments: string }>()

      // 消费管线：对每个解析出的 delta 做副作用（onChunk 回调 + 累积状态）
      // 对照原来的 for await 循环：这里的逻辑一模一样，但"遍历"由 Stream 驱动
      await Effect.runPromise(
        Stream.runForEach(sseDeltaStream, (json) =>
          Effect.sync(() => {
            const delta = json.choices?.[0]?.delta

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
          }),
        ),
      )

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
