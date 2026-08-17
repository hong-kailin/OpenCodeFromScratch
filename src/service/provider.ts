// src/service/provider.ts
// 10.4 课教学代码：ProviderService--把 Provider 包成 Service
//
// 10.3 课把 config 做成了 ConfigService，这课把 provider 也做成 Service。
// 解决的问题（10.1 痛点 3）：index.ts 和 tui/agent.tsx 里各有一份
//   createOpenAIProvider(config)
// 现在 Provider 实例在 Layer 里造一次，谁需要谁 yield* 自取。
//
// 三件套（和 config.ts 一样的结构）：
// 1. ProviderServiceApi  -- 声明这个服务能做什么（能力清单）
// 2. ProviderService     -- tag，用 Context.Service 创建
// 3. providerLayer       -- 造实例（依赖 ConfigService）
//
// 关键点：providerLayer 需要 config 才能造出 provider，所以它要 yield* ConfigService。
// 这就是"Layer 依赖 Layer"——opencode 的 registry.ts 里也这么干
// （yield* Database.Service 拿数据库服务）。10.3 课末尾预告过这个。

import { Context, Effect, Layer } from "effect"
import type { Message, ToolCall } from "../types"
import type { Tool } from "../tool/tool"
import { createOpenAIProvider } from "../provider/openai"
import { ConfigService } from "./config"

// ── 1. ProviderServiceApi：声明能力 ─────────────────────────
// 只有一个能力：chatWithTools（和 Provider 接口的方法一致）
// 返回类型保持 Promise<ChatResult>（10.4 只包 Service，不改返回值类型）
export interface ProviderServiceApi {
  readonly chatWithTools: (
    messages: Message[],
    tools: Tool[],
    onChunk: (text: string) => void,
  ) => Promise<{ text: string; toolCalls: ToolCall[] }>
}

// ── 2. ProviderService：tag ─────────────────────────────────
// 固定模板，和 ConfigService 一样，照抄结构、换名字即可
export class ProviderService extends Context.Service<ProviderService, ProviderServiceApi>()(
  "opencode-from-scratch/Provider",
) {}

// ── 3. providerLayer：造实例 ────────────────────────────────
// Layer.effect 的函数体**只跑一次**（provide 时执行），造出的实例存进 Context。
// 这里展示了 Layer 的依赖：
//   providerLayer 要造 provider，先得拿到 config → yield* ConfigService
// 所以 providerLayer 的 Requirements 是 ConfigService，它"需要" ConfigService 才能构建。
// 这正是 10.3 课末尾说的"Layer 里也能取别的服务"。
export const providerLayer = Layer.effect(
  ProviderService,
  Effect.gen(function* () {
    // 从 Context 取 ConfigService（10.3 课学的取服务）
    const configService = yield* ConfigService
    // 调 get() 拿真正的 Config（baseURL / apiKey / modelID）
    const config = yield* configService.get()

    // createOpenAIProvider(config) 是纯函数，返回一个 Provider 对象
    // 在这里只执行一次，之后所有消费者共享同一个 provider 实例
    const provider = createOpenAIProvider(config)

    // ProviderService.of(...) 把实现对象包装成服务实例，存进 Context
    // chatWithTools 直接转发给内部 provider 的同名方法
    return ProviderService.of({
      chatWithTools: (messages, tools, onChunk) =>
        provider.chatWithTools(messages, tools, onChunk),
    })
  }),
)
