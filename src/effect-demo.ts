// src/effect-demo.ts
// 阶段 10 教学代码：Effect 基础——延迟的计算描述
// 跑法：bun run src/effect-demo.ts
//
// 核心概念：Effect 是"计算的描述"，不是"计算的执行"。
// 你先写好"recipe"（Effect.gen），什么都不发生；runPromise 时才真正执行。
//
// 对照已有知识：
// - Effect 像 PyTorch 的计算图——先 build graph，再 session.run() 才算
// - Effect 是"盒子"，值装在里面；yield* 是"拆盒子"，拿出里面的值
// - Effect.succeed(x) 像 return x，但包成了"将来会产出 x 的描述"
// - Effect.runPromise 是"启动开关"——按下才真正执行

import { Effect } from "effect"

// ═══════════════════════════════════════════════════════════════
// 1. 最简 Effect：succeed——创建一个"将来会产出值"的描述
// ═══════════════════════════════════════════════════════════════
// Effect.succeed(x) 创建一个 Effect，这个 Effect 描述的是"我会产出 x"。
// 注意：到这里什么都没发生，answer 只是一个"描述"，还没执行。

const answer = Effect.succeed(42)

// 要拿到 42，必须 run：
const answerResult = await Effect.runPromise(answer)
console.log("1. succeed:", answerResult) // 42

// ═══════════════════════════════════════════════════════════════
// 2. 延迟性：创建 ≠ 执行
// ═══════════════════════════════════════════════════════════════
// 这是 Effect 最核心的概念。用 console.log 证明：
// Effect.gen 的函数体在创建时不执行，runPromise 时才执行。

console.log("2a. 即将创建 Effect（注意：里面那行日志此刻不该打印）")

const lazy = Effect.gen(function* () {
  console.log("2b. 这行在 Effect 真正执行时才打印！")
  return "lazy result"
})

console.log("2c. Effect 已创建，但还没 run，所以 2b 还没打印")

const lazyResult = await Effect.runPromise(lazy)
console.log("2d. run 完成:", lazyResult)
// 输出顺序：2a → 2c → 2b → 2d
// 2b 排在 2c 后面，证明 Effect.gen 的函数体在 runPromise 时才执行

// ═══════════════════════════════════════════════════════════════
// 3. Effect.gen + yield*：拆盒子，串联多步
// ═══════════════════════════════════════════════════════════════
// 关键概念：Effect 是"盒子"，值装在里面。yield* 是"拆盒子"：
// 运行右边的 Effect，把产出的值拿出来，变成普通值给你用。
// Effect.gen(function* () { ... }) 是允许用 yield* 的"工作台"。
//
// 对照 Python 的 async/await：
//   await = 等异步操作完成，拿到结果
//   yield* = 等 Effect 执行完，拆盒子拿到结果

const sum = Effect.gen(function* () {
  const a = yield* Effect.succeed(10) // 拆盒子：拿出 10
  const b = yield* Effect.succeed(20) // 拆盒子：拿出 20
  return a + b // a、b 是普通数字，可以相加；return 的值自动装回盒子
})

console.log("3. gen 串联多步:", await Effect.runPromise(sum)) // 30

// ═══════════════════════════════════════════════════════════════
// 4. Effect.fail：失败也是"描述"，不是真的抛异常
// ═══════════════════════════════════════════════════════════════
// Effect.fail 创建一个"将来会失败"的描述。和 succeed 一样，创建时不执行。
// runPromise 遇到 fail 会 reject，用 try/catch 接住。

const boom = Effect.fail(new Error("故意失败"))

try {
  await Effect.runPromise(boom)
} catch (e) {
  console.log("4. fail 被 catch:", e instanceof Error ? e.message : e)
}

// ═══════════════════════════════════════════════════════════════
// 5. Effect.promise：把已有的 Promise 代码桥接进 Effect
// ═══════════════════════════════════════════════════════════════
// 我们已经有大量 Promise 代码（fetch、Bun.file、Bun.write）。
// Effect.promise 把它们桥接进 Effect 世界——这是从 Promise 迁移到 Effect 的关键桥梁。
// 参数是一个 async 函数：async () => { ... } 表示函数里可以用 await。

const readFile = Effect.promise(async () => {
  const config = await Bun.file("opencode.json").json()
  return config.model as string
})

const model = await Effect.runPromise(readFile)
console.log("5. promise 桥接，读到 model:", model)

// ═══════════════════════════════════════════════════════════════
// 6. .pipe(Effect.map(...))：在 run 之前变换 Effect
// ═══════════════════════════════════════════════════════════════
// 因为 Effect 是描述，你可以在 run 之前对它做各种变换。
// Effect.map(f) = "这个 Effect 跑完后，把结果再用 f 变换一下"
// .pipe 是"把左边的值传给右边的函数"：obj.pipe(fn) 等价于 fn(obj)
// 这就是"描述而非执行"的好处——组合性强。

const number = Effect.succeed(5)
const doubled = number.pipe(Effect.map((n) => n * 2))
console.log("6. map 单个变换:", await Effect.runPromise(doubled)) // 10

// 链式组合多步变换，全部在 run 之前描述好：
const pipeline = Effect.succeed(3)
  .pipe(Effect.map((n) => n + 10)) // 13
  .pipe(Effect.map((n) => n * 2))  // 26
  .pipe(Effect.map((n) => `结果是 ${n}`))

console.log("   map 链式变换:", await Effect.runPromise(pipeline)) // "结果是 26"

// ═══════════════════════════════════════════════════════════════
// 7. Effect.runSync：同步执行（仅当 Effect 里没有异步操作）
// ═══════════════════════════════════════════════════════════════
// runPromise 返回 Promise（用于包含异步操作的 Effect），
// runSync 直接返回结果（只能用于纯同步的 Effect，如 succeed/map 链）。
// 包含 promise/fetch 等异步操作的 Effect 不能用 runSync，会报错。

const syncResult = Effect.runSync(Effect.succeed(100))
console.log("7. runSync 同步执行:", syncResult) // 100

// ═══════════════════════════════════════════════════════════════
// 8. 组合：Effect.gen 里用 yield* 调 Promise 桥接的 Effect
// ═══════════════════════════════════════════════════════════════
// 把前面学的串起来：gen 里可以 yield* 任何 Effect，包括 promise 桥接的。

const combined = Effect.gen(function* () {
  // 同步的 Effect
  const x = yield* Effect.succeed(10)

  // 异步的 Effect（promise 桥接）
  // readFile 是变量不是函数，它存的是 Effect.promise 返回的 Effect 盒子
  const modelName = yield* readFile // 读 opencode.json

  // 用 Fail 做校验
  if (!modelName) {
    return yield* Effect.fail(new Error("model 为空"))
  }

  return `${modelName} 计算结果是 ${x * 2}`
})

const combinedResult = await Effect.runPromise(combined)
console.log("8. gen 组合同步+异步:", combinedResult)

// ═══════════════════════════════════════════════════════════════
// 9. Debug：fiber trace——Effect 报错时怎么读
// ═══════════════════════════════════════════════════════════════
// Effect 的报错信息包含 fiber trace（类似 Python 的 traceback），
// 能告诉你错误发生在调用链的哪一层。

const failInGen = Effect.gen(function* () {
  const a = yield* Effect.succeed(1)
  const b = yield* Effect.fail(new Error("这里出错了"))
  return a + b // 永远不会执行到这里
})

console.log("9. 观察 fiber trace（下面会打印错误，这是正常的教学演示）：")
try {
  await Effect.runPromise(failInGen)
} catch (e) {
  if (e instanceof Error) {
    console.log("  错误消息:", e.message)
    // fiber trace 通常包含在 e.stack 中，或者 Effect 会生成 Cause 结构
    console.log("  错误栈前两行:", e.stack?.split("\n").slice(0, 2).join("\n"))
  }
}

// ═══════════════════════════════════════════════════════════════
// 小结
// ═══════════════════════════════════════════════════════════════
// - Effect 是"计算的描述"，创建不执行，runPromise 才执行
// - Effect.gen + yield* 拆盒子串联多步 Effect
// - Effect.succeed / Effect.fail 包值和错误
// - Effect.promise 把已有 Promise 桥接进 Effect
// - 因为是描述，可以 .pipe(Effect.map) 在 run 前变换（组合性强）
// - runSync 用于纯同步 Effect，runPromise 用于含异步的 Effect
// - fiber trace 帮助你定位错误发生在哪一层
//
// 下一课（阶段 11）：Service + Layer——用依赖注入解决"参数到处传"的痛点