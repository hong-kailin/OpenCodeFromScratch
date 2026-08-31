// src/agent-loop-validation-demo.ts
// 阶段 13.2 教学代码：agent-loop 里的参数校验 + 错误喂回
// 跑法：bun run src/agent-loop-validation-demo.ts
//
// 解决的问题：agent-loop 执行工具前要校验 LLM 传的参数。
// 关键设计：校验失败【不中断】agent loop，而是把错误文本作为"工具结果"
//           喂回给 LLM，让它自己修正参数再调一次（opencode 的 InvalidArgumentsError 设计）。
//
// 本 demo 模拟一个"会犯错的 LLM"：第一轮传错参数，收到错误后第二轮传对。
// 完整展示：参数校验 → 失败喂回 → LLM 自纠正 → 成功。

import { Effect, Schema } from "effect"
import { ToolError } from "./error/errors"

// ── 一个工具的参数契约（和 read 工具一致）──────────────────
const Parameters = Schema.Struct({
  filePath: Schema.String,
})

// ── 工具的执行函数（真实项目里是 tool.execute）──────────────
async function execute(args: Schema.Schema.Type<typeof Parameters>): Promise<string> {
  // 参数已经过校验，filePath 一定是字符串（类型安全）
  return `成功读取了 ${args.filePath}`
}

// ── 核心：decodeAndRun（和 agent-loop.ts 里的一模一样）──────
// 输入：JSON.parse 之后的对象（unknown）
// 输出：一个"成功则返回工具结果 / 失败则带错误"的 Effect
const decodeAndRun = (rawArgs: unknown) =>
  Schema.decodeUnknownEffect(Parameters)(rawArgs).pipe(
    // mapError：校验失败（SchemaError）→ 转成带 tag 的 ToolError
    // 类比 Promise.catch 里 throw new TypeError("...")
    Effect.mapError(
      (e) => new ToolError({ message: `参数校验失败: ${String(e)}` }),
    ),
    // flatMap：校验通过 → args 类型安全 → 执行工具
    // 类比 Promise.then(args => execute(args))
    Effect.flatMap((args) => Effect.promise(() => execute(args))),
  )

// ── 完整流程 runTool（和 agent-loop.ts 里的 runTool 一致）────
// 输入：LLM 返回的 arguments（JSON 字符串）
// 输出：一定是一个字符串——成功是工具结果，失败是错误说明
const runTool = (argumentsJson: string) =>
  // Effect.try：把可能 throw 的 JSON.parse 包成 Effect（throw → Effect 失败）
  // 类比 Promise.resolve().then(() => JSON.parse(...)) 捕获同步异常
  Effect.try({
    try: () => JSON.parse(argumentsJson),
    catch: (e) =>
      new ToolError({
        message: `参数不是合法 JSON: ${e instanceof Error ? e.message : String(e)}`,
      }),
  }).pipe(
    Effect.flatMap(decodeAndRun),
    // 兜底：任何失败都转成错误文本，绝不 throw 出去中断 loop
    Effect.catch((e) => Effect.succeed(e instanceof Error ? e.message : String(e))),
  )

// ═══════════════════════════════════════════════════════════
// 模拟 agent loop：一个会犯错的 LLM
// ═══════════════════════════════════════════════════════════
console.log("════════ 模拟 agent loop：LLM 犯错 → 被纠正 ════════\n")

// "LLM"的发言序列（模拟两轮 tool call）：
//   第 1 轮：犯错了，把 filePath 传成数字（或缺字段）
//   第 2 轮：看到错误消息后，传对了参数
const llmCalls = [
  '{"filePath": 123}',            // 第 2 轮：类型错
  '{"filePath": "src/read.ts"}',  // 第 3 轮：对了
]

for (let round = 0; round < llmCalls.length; round++) {
  const argumentsJson = llmCalls[round]!
  console.log(`── 第 ${round + 1} 轮：LLM 调用 read(${argumentsJson}) ──`)

  // 执行工具（返回的一定是字符串，不会抛异常）
  const output = await Effect.runPromise(runTool(argumentsJson))

  console.log(`   工具结果: ${output}`)

  // 如果这轮失败了，错误文本会作为 tool 消息喂回给 LLM。
  // 下一轮 LLM 看到"参数校验失败: Expected string, got 123"就知道改参数了。
  console.log(`   [已喂回给 LLM 作为 tool 消息]`)
  console.log("")
}

console.log("════════ 关键观察 ════════")
console.log("1. 每一轮 runTool 都返回字符串，绝不 throw —— loop 不会被中断")
console.log("2. 第 1 轮的失败文本喂回给 LLM，它第 2 轮就改对了参数")
console.log("   这就是 opencode 的设计：InvalidArgumentsError 的错误文本返回给模型自纠正")
console.log("3. 如果错误直接 throw 出去，整个 agent 对话就废了")

console.log("\n════════ 顺便对比：坏 JSON 在哪一层报错 ════════")
const badJsonOutput = await Effect.runPromise(runTool("not json at all"))
console.log("坏 JSON 的结果:", badJsonOutput)
console.log("注意：坏 JSON 在 Effect.try 的 JSON.parse 就失败了，还没轮到 Schema")
