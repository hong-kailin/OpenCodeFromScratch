// src/provider/openai.ts
// OpenAI 兼容 Provider 实现
// 从 llm.ts 的 chatWithTools 搬过来，包成 Provider 接口
// 对照 opencode: packages/llm/src/protocols/openai-chat.ts
// opencode 的 OpenAI Chat 协议实现有 500+ 行（Schema 校验、状态机解析等）
// 我们简化版直接 fetch + SSE 流式解析
//
// 阶段 14 改动：SSE 解析从"命令式 for await 循环"改成"Effect Stream 管线"
// 之前：for await (const chunk of response.body!) { ... } 两层循环，逻辑混在一起
// 现在：response.body → Stream 管线（解码→拆行→过滤data→去前缀→去[DONE]→JSON.parse）
// 对外接口不变（chatWithTools 签名一样），agent-loop / CLI / TUI 都不用动

import { Effect, Stream } from "effect"
import type { Provider, ChatResult } from "./interface"
import type { Message, ToolCall } from "@opencode-from-scratch/schema"
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

      if (!response.body) {
        throw new Error("API 响应没有 body")
      }

      const decoder = new TextDecoder()

      // ═══════════════════════════════════════════════════════════
      // SSE 解析：一条 Stream 管线（阶段 14 重构）
      // ═══════════════════════════════════════════════════════════
      // response.body 是 ReadableStream<Uint8Array>，也是异步可迭代对象
      // （AsyncIterable），所以能直接用 Stream.fromAsyncIterable 接进来。
      //
      // 管线一步步把"原始字节"变成"解析好的 delta 对象"：
      //   1. fromAsyncIterable  字节流 → Stream<Uint8Array>
      //   2. map(解码)          字节块 → 文本（TextDecoder，处理跨块字符）
      //   3. flatMap(拆行)      文本 → 每行一个元素（flatMap 展开成多个）
      //   4. filter(data 行)    只留 "data: " 开头的行（跳过空行/注释）
      //   5. map(去前缀)        去掉 "data: " 得到原始数据
      //   6. filter([DONE])     跳过结束标记
      //   7. map(JSON.parse)    解析成对象
      //
      // 整条管线是"惰性描述"——runForEach 消费时才真正拉取响应体。
      // 每步只做一件事，可独立复用/测试，这是命令式 for 循环做不到的。
      const sseDeltaStream = Stream.fromAsyncIterable(
        response.body,
        (cause) => new Error(`读取流失败: ${String(cause)}`),
      ).pipe(
        Stream.map((chunk) => decoder.decode(chunk, { stream: true })), // 字节 → 文本
        Stream.flatMap((text) => Stream.fromIterable(text.split("\n"))), // 文本 → 行
        Stream.filter((line) => line.startsWith("data: ")), // 只要 data 行
        Stream.map((line) => line.slice(6)), // 去 "data: " 前缀
        Stream.filter((data) => data !== "[DONE]"), // 去结束标记
        Stream.map((data) => JSON.parse(data)), // 解析成对象
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
