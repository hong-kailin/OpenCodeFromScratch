// src/agent-loop-demo.ts
// 阶段 12 教学代码：重构前后对比——agent loop 签名瘦身 + Context 自取
// 跑法：bun run src/agent-loop-demo.ts
//
// 这个 demo 展示重构的核心变化：
// - 重构前：provider 和 tools 是参数，调用方手动传
// - 重构后：provider 和 tools 从 Context 自取，签名变短
//
// 同时演示 onMessage 回调的差异：
// - CLI 版传 onMessage（持久化）
// - TUI 版不传（不持久化）
// 两个入口用同一个 runAgentLoop，只是回调不同

import { Effect, Layer } from "effect"
import { configLayer } from "./service/config"
import { providerLayer } from "./service/provider"
import { toolRegistryLayer } from "./service/tool-registry"
import { runAgentLoop } from "./agent-loop"
import { buildSystemPrompt } from "./system-context"
import type { Message } from "./types"

// Layer 组装
const satisfiedProvider = providerLayer.pipe(Layer.provide(configLayer))
const appLayers = Layer.mergeAll(configLayer, satisfiedProvider, toolRegistryLayer)

// ═══════════════════════════════════════════════════════════════
// 演示：同一个 runAgentLoop，不同回调
// ═══════════════════════════════════════════════════════════════

const messages: Message[] = [
  { role: "system", content: buildSystemPrompt() },
  { role: "user", content: "src/agent-loop.ts 这个文件是做什么的？用 read 工具读一下" },
]

console.log("=== 重构后：runAgentLoop 签名 ==")
console.log("runAgentLoop(messages, callbacks)")
console.log("  provider 和 tools 从 Context 自取——不再传参！")
console.log("")

// 模拟 CLI 版调用（带 onMessage 持久化）
let savedCount = 0
console.log("--- CLI 版（带 onMessage 持久化）---")
await Effect.runPromise(
  runAgentLoop(messages, {
    onChunk(text) {
      process.stdout.write(text)
    },
    onToolCall(_id, name, args) {
      console.log(`\n  [调用工具] ${name}(${args})`)
    },
    onToolResult(_id, _output) {
      // 不展示结果
    },
    onMessage(_msg) {
      savedCount++ // 模拟 saveMessage
    },
  }).pipe(Effect.provide(appLayers)),
)
console.log(`\n\n持久化消息数: ${savedCount}`)

// 对比：如果 TUI 版调用，不传 onMessage
console.log("\n--- TUI 版（不传 onMessage）---")
console.log("runAgentLoop(messages, { onChunk, onToolCall, onToolResult })")
console.log("  // 没有 onMessage——不持久化")
console.log("  // 和 CLI 版是同一个 runAgentLoop，只是回调不同")
console.log("")

// ═══════════════════════════════════════════════════════════════
// 对比：重构前怎么写
// ═══════════════════════════════════════════════════════════════
console.log("=== 重构前 vs 重构后 ===")
console.log("")
console.log("重构前（阶段 9）：")
console.log("  const config = await loadConfig()")
console.log("  const provider = createOpenAIProvider(config)")
console.log("  const tools = [readTool, writeTool, ...]")
console.log("  await runAgentLoop(messages, provider, tools, callbacks)")
console.log("  // 4 个参数，provider/tools 每次手动传")
console.log("")
console.log("重构后（阶段 12）：")
console.log("  await Effect.runPromise(")
console.log("    runAgentLoop(messages, callbacks)")
console.log("      .pipe(Effect.provide(appLayers)),")
console.log("  )")
console.log("  // 2 个参数，provider/tools 从 Context 自取")
console.log("")
console.log("好处：")
console.log("  1. 签名不膨胀——加新依赖不用改签名")
console.log("  2. 单点注册——加工具只改 tool-registry.ts")
console.log("  3. 两个入口合一——CLI 和 TUI 用同一个 loop")