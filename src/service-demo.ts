// src/service-demo.ts
// 10.3 课教学代码：Service + Layer 实战演示
// 跑法：bun run src/service-demo.ts
//
// 这个 demo 展示 ConfigService 的完整用法：
// - 多个函数都"声明需要 ConfigService"（yield* Service）
// - 在最外层 provide 一次 Layer，所有函数自动拿到实现
// - Layer 只读一次文件，所有消费者共享同一份缓存
//
// 文件底部把这一行：
//   await Effect.runPromise(program.pipe(Effect.provide(configLayer)))
// 拆成 4 步写，每步注释说明"执行到这一步时到底做了什么"。

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
// program 是一份"延迟的描述"：
//   - 创建这行时：函数体一个字都没执行
//   - 它只记录了"将来要取 ConfigService，然后依次跑 printModel、printBaseURL"
//   - 现在 run 它，会因为 Context 里没有 ConfigService 而报错
const program = Effect.gen(function* () {
  yield* printModel()
  yield* printBaseURL()
  console.log("两个消费者都拿到了 config，但文件只读了一次（在 Layer 里缓存）")
})

// ════════════════════════════════════════════════════════════
// 运行：provide Layer，把实现塞进 Context
// 原版一行：
//   await Effect.runPromise(program.pipe(Effect.provide(configLayer)))
// 下面拆成 4 步。每一步结尾标注"此刻代码执行到哪里、做了什么"。
// ════════════════════════════════════════════════════════════

// ── 第 1 步：取到 provide 函数 ──────────────────────────────
// Effect.provide(configLayer) 只接收 layer 参数，返回一个"等着收 Effect 的函数"。
// 这叫 data-last（数据最后）：参数先给，数据后给。
// 执行到这一行时：没有真干活。configLayer 的函数体没跑，文件没读。
// 它只是造了一个函数存在 withConfig 里，这个函数将来会"接收一个 Effect，
// 给它配上 configLayer"。
const withConfig = Effect.provide(configLayer)

// ── 第 2 步：组合出新 Effect ────────────────────────────────
// .pipe 是"把左边的值传给右边的函数"：program.pipe(withConfig) 等价于
// withConfig(program)。
// 执行到这一行时：还是没有真干活。configLayer 没跑、program 没跑、文件没读。
// 它只是造出一份**新的延迟描述** stored 里：
//   "执行时：先把 configLayer 造出的实例挂进 Context，再跑 program 的函数体"
// stored 和 program 的区别：
//   - program 说"我要取 ConfigService"（取不到会报错）
//   - stored 说"先造好 ConfigService 挂上去，再取"（取得到）
const stored = program.pipe(withConfig)

// ── 第 3 步：点火 ───────────────────────────────────────────
// 执行到这一行时：真正开始干活了！runPromise 触发执行，返回一个 Promise。
// Effect 的执行从这里开始：
//   ① 跑 configLayer 的 Effect.gen 体（src/service/config.ts:48）
//      - 读 opencode.json（Effect.promise 桥接 Bun.file）
//      - 解析出 providerID、modelID、config
//      - ConfigService.of({ get: ... }) 造出服务实例，挂进 Context
//      - 注意：这一整段只执行一次，之后不会重复读文件
//   ② 跑 program 的函数体
//      - 走到 yield* ConfigService（上面的 printModel）
//      - 从 Context 取出 ① 挂上的实例
//      - config.get() 拿到 Config，打印
//      - 再跑 printBaseURL，同样自取
// 注意：runPromise 返回的是一个 JS Promise。此刻执行已经启动，
// 但读文件是异步的，程序会先去处理其他事，等结果回来再继续。
const running = Effect.runPromise(stored)

// ── 第 4 步：等结果 ─────────────────────────────────────────
// await 是"等这个 Promise 完成"。执行到这里时：
//   - 如果 ③ 步启动的执行还没跑完，程序停在这里等
//   - 等 configLayer 读完文件、program 跑完，Promise 变为"已完成"
//   - program 有 return 值吗？没有。Effect.gen 体里没有 return，
//     所以拿到的结果是 undefined
//   - 如果中途失败（比如文件不存在），await 这里会抛错
await running


// ── 全部跑完后的打印顺序（对照观察）────────────────────────
// 1. "消费者 1 拿到 modelID: deepseek-v4-flash"
// 2. "消费者 2 拿到 baseURL: https://..."
// 3. "两个消费者都拿到了 config，但文件只读了一次（在 Layer 里缓存）"
// 中间没有任何"读文件"的日志——因为读文件发生在 configLayer 里，
// 而 configLayer 的函数体只在 ③ 步跑了一次，之后消费者只是从 Context 取现成实例。
// 这也验证了"provide 一次，全局共享"。
//
// 注意："provide 一次，全局共享"只发生在**同一次执行内部**。
// 下面再 run 一次 stored，你会发现 config 又被重新构造了一遍（文件又读了一次）。
// 原因见最后一行注释。

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

await Effect.runPromise(stored)
// ════ 为什么这里 config 又被重新构造了一遍？ ═════════════════
//
// stored 是份"描述"，不是结果。每次 runPromise 都把整份描述从头执行一遍：
//
//   stored 这份描述 = "① 跑 configLayer（读文件、造实例、挂 Context）
//                      ② 跑 program（自取服务）"
//
//   第一次 runPromise(stored)：
//     ① 读文件 → 造实例 A → 挂上 Context → ② 用 A，跑完
//     执行结束，Context 被丢弃，实例 A 也丢了
//
//   第二次 runPromise(stored)（就是这一行）：
//     又从头开始：① 读文件 → 造实例 B → 挂 Context → ② 用 B
//     它不知道第一次发生过什么
//
// 所以"provide 一次，全局共享"指的是**同一次执行内部**：
// 这一次 run 里 configLayer 的体只跑一次，两个消费者共享同一份实例（文件只读一次）。
// 它**不跨 run**。两次 runPromise 是两次独立执行，各自重新造一份 Context、重新跑 Layer。
//
// 类比：stored 像一份菜谱，每次照着做菜都要重新备料——它不会记住上一道菜切好的料。
//
// 想让 config 真正只造一次（跨 run 复用），两种做法：
//   1. 把造好的实例存到 JS 变量里（Layer 体外面）——但会丧失 Effect 的延迟性
//   2. 用 effect 库的 Layer.memoize——把 Layer 变成惰性单例，
//      整个进程内只造一次，之后所有 run 复用同一份
//      （这两个方案后续课程展开，这里先知道有这么回事）