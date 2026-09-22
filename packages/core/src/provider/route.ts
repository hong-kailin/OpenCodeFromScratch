// Route 是四个独立边界的装配点：
// Protocol 决定数据语义，Endpoint 决定地址，Auth 决定认证，Framing 决定流边界。
// 对照 opencode: packages/llm/src/route/client.ts 的 Route.make
import { Stream } from "effect"
import type { LLMError } from "../error/errors"
import type { Auth } from "./auth"
import type { Endpoint } from "./endpoint"
import { renderEndpoint } from "./endpoint"
import type { Framing } from "./framing"
import type { LLMEvent, LLMRequest, Protocol } from "./protocol"

// 这是 Route 为 HTTP 传输准备好的结果。Provider 只需把这三项交给 fetch，
// 不再分别调用 Protocol、Endpoint 和 Auth。
export interface PreparedRouteRequest {
  readonly url: URL
  readonly headers: Headers
  readonly body: string
}

// Route 对使用方隐藏厂商 Body、VendorEvent 和 State 类型。只有 makeRoute 在装配时
// 需要这些泛型，以保证 Framing 的输出正好能交给 Protocol 的输入。
export interface Route {
  readonly id: string
  readonly prepare: (request: LLMRequest) => PreparedRouteRequest
  readonly events: (
    bytes: Stream.Stream<Uint8Array, LLMError>,
  ) => Stream.Stream<LLMEvent, LLMError>
}

export interface MakeRouteInput<Body, Frame, VendorEvent, State> {
  readonly id: string
  readonly protocol: Protocol<Body, Frame, VendorEvent, State>
  readonly endpoint: Endpoint
  readonly auth: Auth
  readonly framing: Framing<Frame>
}

export function makeRoute<Body, Frame, VendorEvent, State>(
  input: MakeRouteInput<Body, Frame, VendorEvent, State>,
): Route {
  return {
    id: input.id,

    prepare: (request) => {
      const body = input.protocol.encodeRequest(request)
      const url = renderEndpoint(input.endpoint)
      const headers = input.auth.apply(
        new Headers({
          "Content-Type": "application/json",
        }),
      )

      return {
        url,
        headers,
        body: JSON.stringify(body),
      }
    },

    events: (bytes) =>
      // 外层 suspend 保证每次真正运行 Stream 都创建独立 State。不能把 State 放到
      // Route 对象外层，否则两个并发请求会共享工具参数片段。
      Stream.suspend(() => {
        let state = input.protocol.response.initial()

        const translated = input.framing.frame(bytes).pipe(
          Stream.flatMap((frame) => {
            const vendorEvent = input.protocol.response.decodeFrame(frame)
            const result = input.protocol.response.step(state, vendorEvent)
            state = result.state
            return Stream.fromIterable(result.llmEvents)
          }),
        )

        // 内层 suspend 让 finish 在前面的 frame 全部处理完以后才读取最终 state。
        // 如果直接在构造 Stream 时调用 finish，拿到的只会是空的初始状态。
        const finished = Stream.suspend(() =>
          Stream.fromIterable(input.protocol.response.finish(state)),
        )

        return translated.pipe(Stream.concat(finished))
      }),
  }
}
