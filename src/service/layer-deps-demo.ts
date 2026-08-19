// src/service/layer-deps-demo.ts
// 阶段 11.3 课教学代码：Layer 依赖链——providerLayer 需要 ConfigService
// 跑法：bun run src/service/layer-deps-demo.ts
//
// 这个 demo 展示两个关键概念：
// 1. Layer 可以消费别的 Service（providerLayer 里 yield* ConfigService）
// 2. Layer 依赖要显式喂——mergeAll 不会自动解析，直接合并会 typecheck 报错
//
// 对比三个 Service 的依赖关系：
//   configLayer       → 无依赖（独立，读文件即可）
//   toolRegistryLayer → 无依赖（独立，返回固定数组）
//   providerLayer     → 依赖 ConfigService（需要 config 才能造 provider）

import { Effect, Layer } from "effect"
import { ConfigService, configLayer } from "./config"
import { ProviderService, providerLayer } from "./provider"
import { ToolRegistry, toolRegistryLayer } from "./tool-registry"

// ── 消费者：同时使用三个 Service ───────────────────────────
const consumer = Effect.gen(function* () {
  // 从 Context 取三个服务，各自独立
  const config = yield* ConfigService
  const provider = yield* ProviderService
  const tools = yield* ToolRegistry

  const { modelID, baseURL } = yield* config.get()
  console.log("ConfigService: modelID =", modelID)
  console.log("ConfigService: baseURL =", baseURL)
  console.log("ProviderService: chatWithTools 可用 =", typeof provider.chatWithTools === "function")
  console.log("ToolRegistry: 工具数量 =", tools.list().length)
  console.log("ToolRegistry: 工具列表 =", tools.list().map((t) => t.id).join(", "))
})

// ═══════════════════════════════════════════════════════════════
// 关键：Layer 依赖要显式喂
// ═══════════════════════════════════════════════════════════════
//
// 错误写法（取消注释试试，typecheck 会报错）：
//   const appLayers = Layer.mergeAll(configLayer, providerLayer, toolRegistryLayer)
//   // 报错：providerLayer 的 Requirements 包含 ConfigService，还没被满足
//
// 正确写法：providerLayer 需要 ConfigService，所以先喂给它：
//   providerLayer.pipe(Layer.provide(configLayer))
// 这行代码的意思是："把 configLayer 提供的服务，喂给 providerLayer 的需求"
// 结果是一个"不欠任何东西"的 providerLayer

const satisfiedProvider = providerLayer.pipe(Layer.provide(configLayer))
// satisfiedProvider 的类型：Layer<ProviderService, never, never>
// 三个 never 表示：不欠任何服务了，可以直接用

// 现在 mergeAll 三个 Layer（其中 providerLayer 的依赖已被满足）：
const appLayers = Layer.mergeAll(configLayer, satisfiedProvider, toolRegistryLayer)

// ── 运行 ─────────────────────────────────────────────────────
console.log("=== Layer 依赖链演示 ===\n")
await Effect.runPromise(consumer.pipe(Effect.provide(appLayers)))

// ═══════════════════════════════════════════════════════════════
// 对照 opencode
// ═══════════════════════════════════════════════════════════════
// opencode 的 llm/src/route/client.ts 末尾用 Layer.provideMerge 处理：
//   const layer = Layer.effect(LLMClient.Service, ...)
//     .pipe(Layer.provideMerge(registryLayer))
// Layer.provideMerge = provide + merge 一步到位。
// 我们拆开写：先 provide 再 mergeAll，更容易看懂每一步。