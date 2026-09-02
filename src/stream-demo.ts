// src/stream-demo.ts
// 阶段 14.1 教学代码：Effect Stream 基础——惰性拉取式异步序列
// 跑法：bun run src/stream-demo.ts
//
// Stream 是什么：一串值的"异步序列"（类比 Python 的 async generator）。
// 但和 async generator 相比，Stream 的关键不同是【组合性】——
// 你可以像搭流水线一样对一条流做变换（map/filter/tap...），最后再消费它。
//
// 本 demo 分 6 节：
//   1. fromIterable 创建 + runForEach 消费
//   2. map 逐元素变换
//   3. 链式组合：filter + map + tap（流水线）
//   4. runFold 聚合整条流
//   5. fromAsyncIterable：从异步可迭代对象创建（14.2 用它接 response.body）
//   6. 惰性：不消费就不执行（Stream 和 Effect 一样，创建≠执行）

import { Effect, Stream } from "effect"

// ═══════════════════════════════════════════════════════════════
// 1. 创建 + 消费：fromIterable / runForEach
// ═══════════════════════════════════════════════════════════════
console.log("═══ 1. fromIterable 创建 + runForEach 消费 ═══")

// fromIterable：把数组变成 Stream
const numbers = Stream.fromIterable([1, 2, 3, 4, 5])

// runForEach：消费这条流，对每个元素执行一个副作用（打印）
// 这是"点火"——到这里 Stream 才开始真正产生值
await Effect.runPromise(
  Stream.runForEach(numbers, (n) => Effect.sync(() => process.stdout.write(`${n} `))),
)
console.log("  ← 5 个数字被逐个消费")

// ═══════════════════════════════════════════════════════════════
// 2. map：逐元素变换
// ═══════════════════════════════════════════════════════════════
console.log("\n═══ 2. map 逐元素变换 ═══")

// map 和 Effect.map 类似，但作用在"流里的每个元素"上
const doubled = Stream.fromIterable([1, 2, 3]).pipe(
  Stream.map((n) => n * 2), // 每个元素 ×2
)

await Effect.runPromise(
  Stream.runForEach(doubled, (n) => Effect.sync(() => process.stdout.write(`${n} `))),
)
console.log("  ← 每个数都翻倍了")

// ═══════════════════════════════════════════════════════════════
// 3. 链式组合：filter + map + tap（流水线）
// ═══════════════════════════════════════════════════════════════
console.log("\n═══ 3. 链式组合：一条流水线 ═══")

// Stream 的威力：多个变换链式组装，像工厂流水线
//   filter：过滤（保留满足条件的）
//   map   ：变换（每个元素）
//   tap   ：对每个元素做副作用但不改变元素（常用于调试打日志）
const pipeline = Stream.fromIterable([1, 2, 3, 4, 5, 6]).pipe(
  Stream.filter((n) => n % 2 === 0), // 保留偶数：2, 4, 6
  Stream.map((n) => n * 10), // 变成：20, 40, 60
  Stream.tap((n) => Effect.sync(() => console.log(`    [tap] 经过 ${n}`))), // 调试日志
)

await Effect.runPromise(
  Stream.runForEach(pipeline, (n) => Effect.sync(() => process.stdout.write(`  ${n}`))),
)
console.log("\n  ← 数据流: 1..6 → 滤偶数 → 翻10倍 → 打日志 → 输出")

// ═══════════════════════════════════════════════════════════════
// 4. runFold：聚合整条流
// ═══════════════════════════════════════════════════════════════
console.log("\n═══ 4. runFold 聚合 ═══")

// runFold：把流里的所有值"折叠"成一个结果（类比 Python 的 functools.reduce）
// 参数：初始值（惰性函数）+ 折叠函数 (累积值, 当前值) => 新累积值
const sum = await Effect.runPromise(
  Stream.runFold(
    Stream.fromIterable([1, 2, 3, 4, 5]),
    () => 0, // 初始值（注意：beta 版本要求写成惰性函数）
    (acc, n) => acc + n, // 折叠函数
  ),
)
console.log("  1+2+3+4+5 =", sum)

// ═══════════════════════════════════════════════════════════════
// 5. fromAsyncIterable：从异步可迭代对象创建
// ═══════════════════════════════════════════════════════════════
console.log("\n═══ 5. fromAsyncIterable：从异步可迭代对象创建 ═══")

// 为什么重要：网络响应体（response.body）就是异步可迭代对象。
// 14.2 我们用它把 SSE 流接进 Stream 管线。
// 这里用一个简单的 async generator 模拟"分块到达的网络数据"
async function* fakeNetworkChunks() {
  yield "Hel"
  yield "lo "
  yield "World"
}

// fromAsyncIterable(异步迭代器, onError)：把它变成 Stream
// onError 参数：读取过程中出错时怎么处理（返回错误类型）
const fromNetwork = Stream.fromAsyncIterable(
  fakeNetworkChunks(),
  (cause) => new Error(`读取流失败: ${String(cause)}`),
)

// 拼接成完整文本（模拟 14.2 里累积 fullText）
const fullText = await Effect.runPromise(
  Stream.runFold(fromNetwork, () => "", (acc, chunk) => acc + chunk),
)
console.log("  拼接结果:", fullText)

// ═══════════════════════════════════════════════════════════════
// 6. 惰性：不消费就不执行（Stream 的灵魂）
// ═══════════════════════════════════════════════════════════════
console.log("\n═══ 6. 惰性：不消费就不执行 ═══")

// 这个 Stream 的 map 函数里有 console.log
// 如果 Stream 是"立即执行"的，创建时就会打印。但它不会——
const lazy = Stream.fromIterable([1, 2, 3]).pipe(
  Stream.map((n) => {
    console.log(`    [map 执行] ${n}`)
    return n * 2
  }),
)

console.log("  Stream 已创建，但 map 还没执行（惰性！）")
console.log("  现在 runForEach 消费它：")
await Effect.runPromise(
  Stream.runForEach(lazy, (n) => Effect.sync(() => process.stdout.write(`    [输出] ${n}\n`))),
)
console.log("  ← map 的 log 在消费时才出现，证明'不消费就不执行'")

// ═══════════════════════════════════════════════════════════════
// 小结
// ═══════════════════════════════════════════════════════════════
console.log("\n═══ 小结 ═══")
console.log("Stream = 一串值的异步序列，可链式变换（map/filter/tap/flatMap），最后消费（runForEach/runFold）")
console.log("惰性：创建≠执行，消费（runForEach/runFold）才真正拉取和产生值")
console.log("14.2 我们会用它把 SSE 流式响应接成一条管线")
