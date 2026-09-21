// Protocol 负责 LLM API 的数据语义：
// 1. 把项目内部的通用请求翻译成厂商请求 body；
// 2. 把厂商流式事件翻译成项目内部的通用事件。
//
// 它不负责 URL、认证 header 和 SSE 字节分帧。
// 对照 opencode: packages/llm/src/route/protocol.ts
import type { Message, ToolCall } from "@opencode-from-scratch/schema"
import type { Tool } from "../tool/tool"

// Provider 交给 Protocol 的通用请求。这里使用项目自己的字段名和领域类型，
// 不假设厂商最终要求 model、model_id 或其他字段名。
export interface LLMRequest {
  readonly modelID: string
  readonly messages: Message[]
  readonly tools: Tool[]
}

// Protocol 屏蔽厂商事件格式以后，只向 Provider 交付这两种通用结果。
// type 是“可辨识联合”的标签，Provider 可以用 switch 安全地缩小类型。
export type LLMEvent =
  | {
      readonly type: "text-delta"
      readonly text: string
    }
  | {
      readonly type: "tool-call"
      readonly toolCall: ToolCall
    }

// 一帧厂商事件可能更新跨帧状态，也可能产出一个或多个通用事件。
export interface ProtocolStep<State> {
  readonly state: State
  readonly events: LLMEvent[]
}

// Frame 是 Framing 输出的完整 payload；Event 是运行时校验后的厂商事件；
// State 保存工具参数等不能从单帧独立得到的信息。
export interface ProtocolResponse<Frame, Event, State> {
  readonly decodeFrame: (frame: Frame) => Event
  readonly initial: () => State
  readonly step: (state: State, event: Event) => ProtocolStep<State>
  readonly finish: (state: State) => LLMEvent[]
}

// 四个泛型分别描述协议自己的请求 body、输入 frame、厂商事件和跨帧状态。
// 它们都来自具体协议实现，不需要 import 某个叫 Body/Frame/Event/State 的类型。
export interface Protocol<Body, Frame, Event, State> {
  readonly id: string
  readonly encodeRequest: (request: LLMRequest) => Body
  readonly response: ProtocolResponse<Frame, Event, State>
}
