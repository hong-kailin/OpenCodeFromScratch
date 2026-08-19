// src/service-demo.ts
// 阶段 11 教学代码：Service + Layer 实战演示
// 跑法：bun run src/service-demo.ts
//
// 这个 demo 展示 ConfigService 的完整用法：
// - 两个消费者函数都声明"我需要 ConfigService"（yield* ConfigService）
// - 在最外层 provide 一次 configLayer，两个函数自动拿到实现
// - Layer 只读一次文件，两个消费者共享同一份缓存
//
// 对比阶段 10.1 的痛点：
//   之前：const config = await loadConfig()  // 每个入口读一次
//         printModel(config)                   // 手动传参
//   现在：yield* printModel()                  // 不用传参，内部自取

import { Effect } from "effect"
import { ConfigService, configLayer } from "./service/config"

// ── 消费者 1：打印 modelID ──────────────────────────────────
// 这个函数不接收 config 参数，而是用 yield* 从 Context 自取
// 注意：不写返回类型标注，让 TS 自己推断——
// ConfigService 的需求会自动出现在 Effect 的第三个类型参数里
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
    const config = yield* ConfigService
    const { baseURL } = yield* config.get()
    console.log("消费者 2 拿到 baseURL:", baseURL)
  })
}

// ── 主程序：把两个消费者串起来 ──────────────────────────────
// 注意：主程序里也没有 config 参数。它只负责编排，依赖由 Context 自动提供。
// program 是一份"延迟的描述"——创建时函数体一个字都没执行。
// 现在直接 run 它，会因为 Context 里没有 ConfigService 而报错。
const program = Effect.gen(function* () {
  yield* printModel()
  yield* printBaseURL()
  console.log("两个消费者都拿到了 config，但文件只读了一次（在 Layer 里缓存）")
})

// ═══════════════════════════════════════════════════════════════
// 运行：provide Layer，把实现塞进 Context
// 拆成 4 步写，每步注释说明"执行到这一步时到底做了什么"。
// ═══════════════════════════════════════════════════════════════

// ── 第 1 步：取到 provide 函数 ──────────────────────────────
// Effect.provide(configLayer) 只接收 layer 参数，返回一个"等着收 Effect 的函数"。
// 这叫 data-last（数据最后）：参数先给，数据后给。
// 执行到这一行时：没有真干活。configLayer 的函数体没跑，文件没读。
// 它只是造了一个函数存在 withConfig 里，这个函数将来会"接收一个 Effect，给它配上 configLayer"。
const withConfig = Effect.provide(configLayer)

// ── 第 2 步：组合出新 Effect ────────────────────────────────
// .pipe 是"把左边的值传给右边的函数"：program.pipe(withConfig) 等价于 withConfig(program)。
// 执行到这一行时：还是没有真干活。configLayer 没跑、program 没跑、文件没读。
// 它只是造出一份新的延迟描述 stored：
//   "执行时：先把 configLayer 造出的实例挂进 Context，再跑 program 的函数体"
// stored 和 program 的区别：
//   - program 说"我要取 ConfigService"（取不到会报错）
//   - stored 说"先造好 ConfigService 挂上去，再取"（取得到）
const stored = program.pipe(withConfig)

// ── 第 3 步：点火 ───────────────────────────────────────────
// 执行到这一行时：真正开始干活了！runPromise 触发执行，返回一个 Promise。
// Effect 的执行从这里开始：
//   ① 跑 configLayer 的 Effect.gen 体（src/service/config.ts）
//      - 读 opencode.json（Effect.promise 桥接 Bun.file）
//      - 解析出 providerID、modelID、config
//      - ConfigService.of({ get: ... }) 造出服务实例，挂进 Context
//      - 注意：这一整段只执行一次，之后不会重复读文件
//   ② 跑 program 的函数体
//      - 走到 yield* ConfigService → 从 Context 取出 ① 挂上的实例
//      - config.get() 拿到 Config，打印
//      - 再跑 printBaseURL，同样自取
const running = Effect.runPromise(stored)

// ── 第 4 步：等结果 ─────────────────────────────────────────
// await 是"等这个 Promise 完成"。执行到这里时：
//   - 如果第 3 步启动的执行还没跑完，程序停在这里等
//   - 等 configLayer 读完文件、program 跑完，Promise 变为"已完成"
//   - 如果中途失败（比如文件不存在），await 这里会抛错
await running

// ── 全部跑完后的打印顺序 ────────────────────────────────────
// 1. "消费者 1 拿到 modelID: deepseek-v4-flash"
// 2. "消费者 2 拿到 baseURL: https://..."
// 3. "两个消费者都拿到了 config，但文件只读了一次（在 Layer 里缓存）"
// 中间没有任何"读文件"的日志——读文件发生在 configLayer 里，
// 而 configLayer 的函数体只跑了一次，之后消费者只是从 Context 取现成实例。

// ═══════════════════════════════════════════════════════════════
// 注意："provide 一次，全局共享"只发生在同一次 run 内部
// ═══════════════════════════════════════════════════════════════
// 下面再 run 一次 stored，config 会被重新构造（文件又读了一次）。
// 验证这一点：
console.log("\n--- 第二次 run，config 会被重新构造 ---")
await Effect.runPromise(stored)
// stored 是份"描述"，不是结果。每次 runPromise 都把整份描述从头执行一遍。
// 所以"provide 一次，全局共享"指的是**同一次执行内部**：一次 run 里
// configLayer 的体只跑一次，两个消费者共享同一份实例。
// 它**不跨 run**。两次 runPromise 是两次独立执行，各自重新造 Context。
//
// 类比：stored 像一份菜谱，每次照着做菜都要重新备料——它不会记住上一道菜切好的料。

// ═══════════════════════════════════════════════════════════════
// program、withConfig、stored 三者关系
// ═══════════════════════════════════════════════════════════════
//
// 这三个变量是"层层包装"的关系，每一层都不执行，只是造一份新描述：
//
//   program = Effect.gen(function* () { ... })
//       ↑ 原始描述："取 ConfigService → 跑 printModel → 跑 printBaseURL"
//       但 Context 里没有 ConfigService，直接 run 会报错
//
//   withConfig = Effect.provide(configLayer)
//       ↑ 不是 Effect，是一个函数："接收一个 Effect，给它配上 configLayer"
//       此刻什么都没执行，文件没读
//
//   stored = program.pipe(withConfig)
//       ↑ 等价于 withConfig(program)
//       ↑ 新描述："先跑 configLayer 造实例挂 Context，再跑 program 的函数体"
//       ↑ 和 program 的区别：stored 的 Context 里有 ConfigService 了
//       此刻还是什么都没执行，文件没读
//
//   Effect.runPromise(stored)  ← 到这里才真正执行！
//
// 所以 program → stored 的过程就是"给原始描述补上依赖"的过程。
// 补完之后 stored 是一份"自给自足"的描述，可以 run 了。
// 但 stored 本身还是描述，没有缓存结果——每次 runPromise(stored) 都从头执行。