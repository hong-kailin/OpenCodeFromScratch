// OpenAI Chat Completions Protocol 的请求与响应翻译。
// 它只处理数据格式，不知道 URL、认证方式和 SSE 字节边界。
// 对照 opencode: packages/llm/src/protocols/openai-chat.ts
import { Schema } from "effect"
import type { Message } from "@opencode-from-scratch/schema"
import { toolToOpenAIFormat } from "../tool/tool"
import type { LLMEvent, Protocol } from "./protocol"

// 这是最终交给 JSON.stringify 的厂商原生 body。
// modelID -> model、Tool -> OpenAI function tool 都由本 Protocol 决定。
export interface OpenAIChatBody {
  readonly model: string
  readonly stream: true
  readonly messages: Message[]
  readonly tools: ReturnType<typeof toolToOpenAIFormat>[]
}

// TypeScript 类型会在运行后消失，所以外部 JSON 不能只靠 interface。
// Schema.Struct 既产生 TypeScript 类型，也能在运行时检查厂商事件的形状。
const OpenAIChatToolCallDelta = Schema.Struct({
  index: Schema.Number,
  id: Schema.optional(Schema.String),
  function: Schema.optional(
    Schema.Struct({
      name: Schema.optional(Schema.String),
      arguments: Schema.optional(Schema.String),
    }),
  ),
})

const OpenAIChatEvent = Schema.Struct({
  choices: Schema.Array(
    Schema.Struct({
      delta: Schema.Struct({
        content: Schema.optional(Schema.NullOr(Schema.String)),
        tool_calls: Schema.optional(Schema.Array(OpenAIChatToolCallDelta)),
      }),
    }),
  ),
})

type OpenAIChatEvent = Schema.Schema.Type<typeof OpenAIChatEvent>

interface PartialToolCall {
  readonly id: string
  readonly name: string
  readonly arguments: string
}

// arguments 会跨多个 SSE frame 到达，因此它不能是 step 函数里的局部变量。
// index 区分并行出现的多个工具调用。
interface OpenAIChatState {
  readonly toolCalls: ReadonlyMap<number, PartialToolCall>
}

const decodeOpenAIChatEvent = Schema.decodeUnknownSync(OpenAIChatEvent)

export const openAIChatProtocol: Protocol<
  OpenAIChatBody,
  string,
  OpenAIChatEvent,
  OpenAIChatState
> = {
  id: "openai-chat",
  encodeRequest: (request) => ({
    model: request.modelID,
    stream: true,
    messages: request.messages,
    tools: request.tools.map(toolToOpenAIFormat),
  }),

  response: {
    // JSON.parse 只能证明字符串是合法 JSON；Schema 继续证明 JSON 的结构
    // 真的是 OpenAI Chat event，而不是 choices: "wrong" 之类的值。
    decodeFrame: (frame) => decodeOpenAIChatEvent(JSON.parse(frame)),

    initial: () => ({ toolCalls: new Map() }),

    step: (state, event) => {
      const delta = event.choices[0]?.delta
      const events: LLMEvent[] = []

      if (delta?.content) {
        events.push({ type: "text-delta", text: delta.content })
      }

      // 每一步复制 Map，再把当前 frame 的参数片段拼进去。
      // 这样输入 state 不会被偷偷修改，调试时能清楚比较 step 前后的状态。
      const toolCalls = new Map(state.toolCalls)
      for (const toolCall of delta?.tool_calls ?? []) {
        const current = toolCalls.get(toolCall.index)
        toolCalls.set(toolCall.index, {
          id: toolCall.id ?? current?.id ?? "",
          name: toolCall.function?.name ?? current?.name ?? "",
          arguments: `${current?.arguments ?? ""}${toolCall.function?.arguments ?? ""}`,
        })
      }

      return {
        state: { toolCalls },
        events,
      }
    },

    // 只有流结束时 arguments 才完整。此时 Protocol 才发布通用 tool-call，
    // Provider 因而不需要知道 OpenAI 用 index 和字符串片段传工具参数。
    finish: (state) =>
      Array.from(state.toolCalls.values()).map((toolCall) => ({
        type: "tool-call" as const,
        toolCall: {
          id: toolCall.id,
          type: "function" as const,
          function: {
            name: toolCall.name,
            arguments: toolCall.arguments,
          },
        },
      })),
  },
}
