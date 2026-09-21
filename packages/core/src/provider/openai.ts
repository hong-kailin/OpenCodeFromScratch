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
// 阶段 17.3 把 Bearer header 构造抽成 Auth，Provider 只把 Auth 结果交给 fetch
// 阶段 17.4 把请求 body 转换、响应校验、delta 翻译和工具参数拼接统一抽进 Protocol
// 对外接口不变（chatWithTools 签名一样），agent-loop / CLI / TUI 都不用动

import { Effect, Stream } from "effect"
import type { Provider, ChatResult } from "./interface"
import type { Message, ToolCall } from "@opencode-from-scratch/schema"
import type { Tool } from "../tool/tool"
import { LLMError } from "../error/errors"
import { debug } from "../debug"
import { sseFraming } from "./framing"
import type { Endpoint } from "./endpoint"
import { renderEndpoint } from "./endpoint"
import { bearerAuth } from "./auth"
import { openAIChatProtocol } from "./openai-chat-protocol"
import type { LLMEvent } from "./protocol"

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
  const auth = bearerAuth(config.apiKey)

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
      const headers = auth.apply(
        new Headers({
          "Content-Type": "application/json",
        }),
      )
      const body = openAIChatProtocol.encodeRequest({
        modelID: config.modelID,
        messages,
        tools,
      })

      debug("API 请求:")
      debug(`  POST ${url.toString()}`)
      debug(`  model: ${config.modelID}`)
      debug(`  messages: ${messages.length} 条`)
      debug(`  tools: ${tools.map((t) => t.id).join(", ")}`)
      debug(`  stream: true`)

      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
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
      // SSE 响应流水线：Framing + Protocol
      // ═══════════════════════════════════════════════════════════
      // response.body 是 ReadableStream<Uint8Array>，也是异步可迭代对象
      // （AsyncIterable），所以能直接用 Stream.fromAsyncIterable 接进来。
      //
      // Framing 只判断事件边界，Protocol 只理解事件内容：
      //   1. fromAsyncIterable  字节流 → Stream<Uint8Array>
      //   2. sseFraming         字节流 → 完整 data payload
      //   3. Protocol decode    payload → 经过 Schema 校验的 OpenAI event
      //   4. Protocol step      OpenAI event → 通用 LLMEvent
      const byteStream = Stream.fromAsyncIterable(
        response.body,
        (cause) => new LLMError({ message: `读取流失败: ${String(cause)}` }),
      )
      const frameStream = sseFraming.frame(byteStream)

      // Provider 现在只累积项目通用结果。它不再读取 choices[0].delta，
      // 也不知道 OpenAI 的工具 arguments 会按 index 分成多帧。
      let fullText = ""
      const toolCalls: ToolCall[] = []
      let protocolState = openAIChatProtocol.response.initial()

      const consume = (event: LLMEvent) => {
        if (event.type === "text-delta") {
          debug(`LLM event: text-delta="${event.text}"`)
          onChunk(event.text)
          fullText += event.text
          return
        }

        debug(`LLM event: tool-call id=${event.toolCall.id} name=${event.toolCall.function.name}`)
        toolCalls.push(event.toolCall)
      }

      // step 每处理一帧就返回“新状态 + 本帧产生的通用事件”。
      // 跨帧工具参数被保存在 protocolState 内，而不是泄漏给 Provider。
      await Effect.runPromise(
        Stream.runForEach(frameStream, (frame) =>
          Effect.sync(() => {
            const vendorEvent = openAIChatProtocol.response.decodeFrame(frame)
            const result = openAIChatProtocol.response.step(protocolState, vendorEvent)
            protocolState = result.state
            result.events.forEach(consume)
          }),
        ),
      )

      // 流结束是一个有业务含义的边界：此时 Protocol 才能确认工具参数已经完整。
      openAIChatProtocol.response.finish(protocolState).forEach(consume)

      debug(`SSE 流结束: 文本 ${fullText.length} 字符, ${toolCalls.length} 个工具调用`)

      return { text: fullText, toolCalls }
    },
  }
}
