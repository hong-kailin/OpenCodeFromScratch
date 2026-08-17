// src/effect-demo.ts
// 10.2 课教学代码：Effect 基础--一个延迟的计算描述
// 跑法：bun run src/effect-demo.ts
//
// 这个文件演示 Effect-TS 的最核心概念：Effect 是"计算的描述"，不是"计算的执行"。
// 你先写好"recipe"（Effect.gen），什么都不发生；再交给"厨师"（runPromise）才真正执行。
//
// 对照已有知识：
// - Effect 像 PyTorch 的计算图--你先 build graph，再 session.run() 才算
// - Effect 是个"盒子"，值装在里面；yield* 是"拆盒子"，拿出里面的值
// - Effect.succeed(x) 像 return x，但包成了"将来会产出 x 的描述"
// - Effect.runPromise 是"启动开关"--按下才真正执行那个延迟的计算

import { Effect } from "effect"

// ──────────────────────────────────────────────────────────────
// 1. 最简 Effect：创建一个"将来会产出 42"的描述
// ──────────────────────────────────────────────────────────────

const answer = Effect.succeed(42)
// 注意：到这里什么都没发生。answer 只是一个"描述"，还没执行。
// 要拿到 42，必须 run：

const answerResult = await Effect.runPromise(answer)
// await 是 JS 的"等它完成"语法：等 runPromise 跑完，拿到 42
console.log("1. succeed:", answerResult) // 42

// ──────────────────────────────────────────────────────────────
// 2. 延迟性：创建 ≠ 执行
// ──────────────────────────────────────────────────────────────
// 这是最关键的概念。用 console.log 证明：Effect.gen 的函数体在创建时不执行。

console.log("2a. 即将创建 Effect（注意：里面那行日志此刻不该打印）")

const lazy = Effect.gen(function* () {
  console.log("2b. 这行在 Effect 真正执行时才打印！")
  return "lazy result"
})

console.log("2c. Effect 已创建，但还没 run，所以 2b 还没打印")

const lazyResult = await Effect.runPromise(lazy)
console.log("2d. run 完成:", lazyResult)
// 输出顺序：2a -> 2c -> 2b -> 2d
// 2b 排在 2c 后面，证明 Effect.gen 体在 runPromise 时才执行

// ──────────────────────────────────────────────────────────────
// 3. Effect.gen + yield*：拆盒子，串联多步
// ──────────────────────────────────────────────────────────────
// 关键概念：Effect 是个"盒子"，值装在里面。yield* 是"拆盒子"：
// 运行右边的 Effect，把产出的值拿出来，变成普通值给你用。
// Effect.gen(function* () { ... }) 是允许用 yield* 的"工作台"。

const sum = Effect.gen(function* () {
  const a = yield* Effect.succeed(10) // 拆盒子：拿出 10
  const b = yield* Effect.succeed(20) // 拆盒子：拿出 20
  return a + b // a、b 是普通数字，可以相加；return 的值自动装回盒子
})

console.log("3. gen 串联:", await Effect.runPromise(sum)) // 30

// ──────────────────────────────────────────────────────────────
// 4. Effect.promise：把已有的 Promise 代码包进 Effect
// ──────────────────────────────────────────────────────────────
// 我们已经有大量 Promise 代码（fetch、Bun.file）。Effect.promise 把它们桥接进 Effect 世界。
// 这是从现有的 Promise 代码迁移到 Effect 的关键桥梁。
// async () => 是 JS 语法：表示这个函数里可以用 await 等待异步操作完成。

const readFile = Effect.promise(async () => {
  // 读 opencode.json（项目里真实存在的文件）
  // await = 等 Bun.file(...).json() 这个异步操作完成，拿到结果
  const config = await Bun.file("opencode.json").json()
  return config.model as string
})

const model = await Effect.runPromise(readFile)
console.log("4. promise 桥接，读到 model:", model)

// ──────────────────────────────────────────────────────────────
// 5. Effect.fail：失败也是"描述"，不是真的抛异常
// ──────────────────────────────────────────────────────────────
// Effect.fail 创建一个"将来会失败"的描述。和 succeed 一样，创建时不执行。
// runPromise 遇到 fail 会 reject，用 try/catch 或 .catch 接住。

const boom = Effect.fail(new Error("故意失败"))

try {
  await Effect.runPromise(boom)
} catch (e) {
  console.log("5. fail 被 catch:", e instanceof Error ? e.message : e)
}

// ──────────────────────────────────────────────────────────────
// 6. 组合性：在 run 之前变换 Effect（这是"描述"的威力）
// ──────────────────────────────────────────────────────────────
// 因为 Effect 是描述，你可以在 run 之前对它做各种变换，像处理数据一样处理"计算"。
// .pipe(Effect.map(f)) = "这个 Effect 跑完后，把结果再用 f 变换一下"
// 这就是"描述而非执行"的好处--组合性强。

const number = Effect.succeed(5)
const doubled = number.pipe(Effect.map((n) => n * 2))
console.log("6. map 变换:", await Effect.runPromise(doubled)) // 10

// 还能链式组合多步变换，全部在 run 之前描述好：
const pipeline = Effect.succeed(3)
  .pipe(Effect.map((n) => n + 10)) // 13
  .pipe(Effect.map((n) => n * 2)) // 26
  .pipe(Effect.map((n) => `结果是 ${n}`))

console.log("   map 链:", await Effect.runPromise(pipeline)) // "结果是 26"

// ──────────────────────────────────────────────────────────────
// 小结
// ──────────────────────────────────────────────────────────────
// - Effect 是"计算的描述"，创建不执行，runPromise 才执行
// - Effect.gen + yield* 拆盒子串联多步 Effect
// - Effect.succeed / Effect.fail 包值和错误
// - Effect.promise 把已有 Promise 桥接进 Effect
// - 因为是描述，可以 .pipe(Effect.map) 在 run 前变换（组合性强）
//
// 下一课（10.3）用 Service + Layer 给这个"描述"加上依赖注入：
// Effect.gen 里的 yield* 不只能取 Effect 的值，还能"取服务"。
