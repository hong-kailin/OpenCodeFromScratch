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
// 阶段 17.5 用 Route 装配四轴，Provider 只负责 HTTP 调用和 ChatResult 累积
// 对外接口不变（chatWithTools 签名一样），agent-loop / CLI / TUI 都不用动

import { Effect, Stream } from "effect"
import type { Provider, ChatResult } from "./interface"
import type { Message, ToolCall } from "@opencode-from-scratch/schema"
import type { Tool } from "../tool/tool"
import { LLMError } from "../error/errors"
import { debug } from "../debug"
import type { LLMEvent } from "./protocol"
import { createOpenAIChatRoute } from "./openai-chat-route"

// 创建 OpenAI 兼容 Provider
// config 由 loadConfig() 从 opencode.json 读取
// 对照 opencode: providers/openai.ts 的 configure() 函数
// opencode 的 configure 支持多种配置（auth、transport、headers 等），我们简化为 baseURL + apiKey + modelID
export function createOpenAIProvider(config: {
  baseURL: string
  apiKey: string
  modelID: string
}): Provider {
  // 具体四轴组合只在 Route 定义中出现。Provider 选择的是一条已经装配好的路线。
  const route = createOpenAIChatRoute({
    baseURL: config.baseURL,
    apiKey: config.apiKey,
  })

  return {
    id: "openai",

    async chatWithTools(
      messages: Message[],
      tools: Tool[],
      onChunk: (text: string) => void,
    ): Promise<ChatResult> {
      // 发流式请求（带 tools）
      // 调试：打印 API 请求详情（不打印 apiKey，安全考虑）
      const prepared = route.prepare({
        modelID: config.modelID,
        messages,
        tools,
      })

      debug("API 请求:")
      debug(`  route: ${route.id}`)
      debug(`  POST ${prepared.url.toString()}`)
      debug(`  model: ${config.modelID}`)
      debug(`  messages: ${messages.length} 条`)
      debug(`  tools: ${tools.map((t) => t.id).join(", ")}`)
      debug(`  stream: true`)

      const response = await fetch(prepared.url, {
        method: "POST",
        headers: prepared.headers,
        body: prepared.body,
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
      // SSE 响应流水线：Route
      // ═══════════════════════════════════════════════════════════
      // response.body 是 ReadableStream<Uint8Array>，也是异步可迭代对象
      // （AsyncIterable），所以能直接用 Stream.fromAsyncIterable 接进来。
      //
      // Route 内部已经把 Framing 和 Protocol 串好：
      //   1. fromAsyncIterable  字节流 → Stream<Uint8Array>
      //   2. route.events       字节流 → 通用 LLMEvent
      const byteStream = Stream.fromAsyncIterable(
        response.body,
        (cause) => new LLMError({ message: `读取流失败: ${String(cause)}` }),
      )
      const eventStream = route.events(byteStream)

      // Provider 现在只累积项目通用结果。它不再读取 choices[0].delta，
      // 也不知道 OpenAI 的工具 arguments 会按 index 分成多帧。
      let fullText = ""
      const toolCalls: ToolCall[] = []
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

      await Effect.runPromise(
        Stream.runForEach(eventStream, (event) => Effect.sync(() => consume(event))),
      )

      debug(`SSE 流结束: 文本 ${fullText.length} 字符, ${toolCalls.length} 个工具调用`)

      return { text: fullText, toolCalls }
    },
  }
}
