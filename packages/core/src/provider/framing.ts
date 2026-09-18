// Framing 是 HTTP 字节流与 Provider 协议之间的边界。
//
// 输入只是一块块 Uint8Array；输出是一条条完整的 frame。Framing 不读取
// choices[0].delta 等业务字段，因为那些字段属于 Protocol，后续课程再拆。
//
// 对照 opencode: packages/llm/src/route/framing.ts
import { Stream } from "effect"
import * as Sse from "effect/unstable/encoding/Sse"
import type { LLMError } from "../error/errors"

// Frame 使用泛型，是因为不同传输格式产生的 frame 不同：
// SSE 输出字符串；AWS event-stream 将来会输出二进制事件对象。
export interface Framing<Frame> {
  readonly id: string
  readonly frame: (bytes: Stream.Stream<Uint8Array, LLMError>) => Stream.Stream<Frame, LLMError>
}

// SSE Framing 只负责三件事：
// 1. decodeText 跨 chunk 保存 UTF-8 解码状态；
// 2. Sse.decode 跨 chunk 保存半行和半个事件，直到空行标志事件结束；
// 3. 丢弃没有数据的事件和 OpenAI 风格的 [DONE] 结束标记。
//
// 最终输出仍是字符串。JSON.parse 和字段解释属于 Protocol，不放在这里。
export const sseFraming: Framing<string> = {
  id: "sse",
  frame: (bytes) =>
    bytes.pipe(
      Stream.decodeText(),
      Stream.pipeThroughChannel(Sse.decode()),
      // SSE 的 retry: 指令要求客户端稍后重连。当前简化版还没有重连机制，
      // 所以和真实 opencode 的 Framing 一样先忽略这类控制事件。
      Stream.catchTag("Retry", () => Stream.empty),
      Stream.filter((event) => event.data.length > 0 && event.data !== "[DONE]"),
      Stream.map((event) => event.data),
    ),
}
