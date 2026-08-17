// src/service-demo.ts
// 10.3 课教学代码：Service + Layer 实战演示
// 跑法：bun run src/service-demo.ts
//
// 这个 demo 展示 ConfigService 的完整用法：
// - 多个函数都"声明需要 ConfigService"（yield* Service）
// - 在最外层 provide 一次 Layer，所有函数自动拿到实现
// - Layer 只读一次文件，所有消费者共享同一份缓存

import { Effect } from "effect"
import { ConfigService, configLayer } from "./service/config"

// ── 消费者 1：打印 modelID ──────────────────────────────────
// 这个函数不接收 config 参数，而是用 yield* 从 Context 自取
// 注意：不写返回类型标注，让 TS 自己推断（Effect 的第三个类型参数是"需求"，
// 这里需要 ConfigService，TS 会自动推断出来，不用手写）
function printModel() {
  return Effect.gen(function* () {
    const config = yield* ConfigService // 从 Context 取 ConfigService 实例
    const { modelID } = yield* config.get() // 调 get()，拿到 Config
    console.log("消费者 1 拿到 modelID:", modelID)
  })
}

// ── 消费者 2：打印 baseURL ──────────────────────────────────
// 另一个函数，也自己取 ConfigService，不用参数传进来
function printBaseURL() {
  return Effect.gen(function* () {
    const config = yield* ConfigService // 同样从 Context 取
    const { baseURL } = yield* config.get()
    console.log("消费者 2 拿到 baseURL:", baseURL)
  })
}

// ── 主程序：把两个消费者串起来 ──────────────────────────────
// 注意：主程序里也没有 config 参数。它只负责编排，依赖由 Context 自动提供。
const program = Effect.gen(function* () {
  yield* printModel()
  yield* printBaseURL()
  console.log("两个消费者都拿到了 config，但文件只读了一次（在 Layer 里缓存）")
})

// ── 运行：provide Layer，把实现塞进 Context ────────────────
// Effect.provide(configLayer) 在 run 之前把 ConfigService 的实现装配好。
// 这就是 10.2 课说的"延迟性的好处"--run 之前能装配依赖。
await Effect.runPromise(program.pipe(Effect.provide(configLayer)))

// ── 对比：之前怎么做的 ──────────────────────────────────────
// 之前（10.1 痛点）：
//   const config = await loadConfig()  // 读文件
//   printModel(config)                  // 手动传参
//   printBaseURL(config)                // 手动传参
//
// 现在（Service/Layer）：
//   yield* printModel()                 // 不用传参，内部自取
//   yield* printBaseURL()               // 不用传参，内部自取
//   // config 在 Layer 里读一次，缓存共享
//
// 这就是"工具管理处"：config 造一次，谁需要谁自取，不用层层传参。
