// 这一文件声明一条具体路线：OpenAI Chat + 指定地址 + Bearer Auth + SSE。
// Provider 只选择这条已经装配好的 Route，不再亲自选择四个零件。
import { bearerAuth } from "./auth"
import type { Endpoint } from "./endpoint"
import { sseFraming } from "./framing"
import { openAIChatProtocol } from "./openai-chat-protocol"
import { makeRoute } from "./route"

export function createOpenAIChatRoute(config: {
  readonly baseURL: string
  readonly apiKey: string
}) {
  const endpoint: Endpoint = {
    baseURL: config.baseURL,
    path: "/chat/completions",
  }

  return makeRoute({
    id: "openai-chat",
    protocol: openAIChatProtocol,
    endpoint,
    auth: bearerAuth(config.apiKey),
    framing: sseFraming,
  })
}
