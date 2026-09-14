// src/service/provider.ts
// 阶段 11.3 课教学代码：ProviderService——Layer 依赖 Layer
//
// 11.1-11.2 课把 config 做成了 ConfigService，这课把 provider 也做成 Service。
// 关键点：providerLayer 需要 config 才能造出 provider。
// 所以 providerLayer 的构造函数里要 yield* ConfigService——这就是"Layer 依赖 Layer"。
//
// 三件套（和 config.ts 一样的结构）：
// 1. ProviderServiceApi  -- 声明这个服务能做什么
// 2. ProviderService     -- tag，用 Context.Service 创建
// 3. providerLayer       -- 造实例（依赖 ConfigService）
//
// 对照 opencode：core/src/tool/registry.ts 里也这么干（yield* Database.Service 拿数据库服务）

import { Context, Effect, Layer } from "effect"
import type { Message, ToolCall } from "@opencode-from-scratch/schema"
import type { Tool } from "../tool/tool"
import { createOpenAIProvider } from "./openai"
import { ConfigService } from "../config/config"

// ── 1. ProviderServiceApi：声明能力 ─────────────────────────
// 只有一个能力：chatWithTools（和之前 Provider 接口的方法一致）
// 返回类型保持 Promise<ChatResult>（阶段 11 只包 Service，不改返回值类型）
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
// 所以 providerLayer 的 Requirements 包含 ConfigService——它"需要" ConfigService 才能构建。
// 组装时必须显式喂：providerLayer.pipe(Layer.provide(configLayer))
export const providerLayer = Layer.effect(
  ProviderService,
  Effect.gen(function* () {
    // 从 Context 取 ConfigService（11.1-11.2 课学的取服务）
    const configService = yield* ConfigService
    // 调 get() 拿真正的 Config（baseURL / apiKey / modelID）
    const config = yield* configService.get()

    // createOpenAIProvider(config) 是纯函数，返回一个 Provider 对象
    const provider = createOpenAIProvider(config)

    // ProviderService.of(...) 把实现对象包装成服务实例，存进 Context
    return ProviderService.of({
      chatWithTools: (messages, tools, onChunk) =>
        provider.chatWithTools(messages, tools, onChunk),
    })
  }),
)