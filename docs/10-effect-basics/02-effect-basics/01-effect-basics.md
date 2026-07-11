# 10.2 Effect 基础：一个延迟的计算描述

> 本课目标：搞懂 Effect 到底是什么，跑通第一个 Effect 程序。核心只有一个概念--Effect 是"计算的描述"，不是"计算的执行"。

## Effect 是什么：先 build，后 run

用一个你一定熟悉的类比：**PyTorch 的计算图**。

在 PyTorch（或 TensorFlow 1.x）里，你写 `y = torch.matmul(x, w)` 时，它不是立刻算出结果，而是**先把计算步骤记录成一张图**。你反复操作，图越建越大，但什么都没真算。直到你触发执行（前向传播 / `session.run()`），整张图才按顺序跑起来，产出真实数值。

Effect 是一模一样的思路：

- **写 Effect**（`Effect.gen`、`Effect.succeed`）= build 计算图。只是描述"将来要做什么"，什么都不执行。
- **run Effect**（`Effect.runPromise`）= `session.run()`。这时才真正按描述执行，产出结果。

为什么要这样？因为"描述"可以组合、变换、传递，而"执行"一旦开始就停不下来了。先 build 再 run，让你在 run 之前对计算做各种加工（下一课的 Service/Layer 就建立在这之上）。

## 和 Promise 的关键区别

Promise 是**急切的**（eager）--你创建一个 Promise，它立刻开始执行，你只是等着拿结果。

```ts
// Promise：创建即执行
const p = new Promise((resolve) => {
  console.log("马上就跑了")
  resolve(1)
})
// 上面这行一执行，"马上就跑了"立刻打印
```

Effect 是**惰性的**（lazy）--你创建一个 Effect，它什么都不做，只是记下了"将来要这么干"。直到你 `runPromise`，才真正开始。

```ts
const e = Effect.gen(function* () {
  console.log("现在才跑")
  return 1
})
// 创建 e，"现在才跑"不会打印
await Effect.runPromise(e)  // 这时才打印
```

这就是 Effect 比 Promise 更"可控"的地方：你能决定它**什么时候**跑、**要不要**跑、跑之前**怎么变换**它。

## 安装 Effect

```bash
bun add effect@beta
```

我们用 v4 beta，和 opencode 对齐（opencode 用 `effect@4.0.0-beta.83`）。

## 第一个 Effect 程序

看 `src/effect-demo.ts`，跟着注释跑一遍：

```bash
bun run src/effect-demo.ts
```

下面逐段讲。

### 1. succeed：创建一个"将来产出 42"的描述

```ts
const answer = Effect.succeed(42)
// 到这里什么都没发生，answer 只是个描述
const answerResult = await Effect.runPromise(answer) // run，拿到 42
```

`Effect.succeed(42)` 的意思是"一个将来会产出 42 的 Effect"。它本身不是 42，是"产出 42 的承诺"。`runPromise` 把这个承诺兑现。

### 2. 延迟性：创建 ≠ 执行（最关键）

demo 里这段最能说明问题，看它的输出顺序：

```
2a. 即将创建 Effect（注意：里面那行日志此刻不该打印）
2c. Effect 已创建，但还没 run，所以 2b 还没打印
2b. 这行在 Effect 真正执行时才打印！
2d. run 完成: lazy result
```

注意 **2b 排在 2c 后面**。代码里 2b 写在 2a 之后、2c 之前，但实际打印却在 2c 之后--因为 `Effect.gen` 的函数体在创建时不执行，只有 `runPromise` 调用时才执行。这就是"描述 ≠ 执行"的铁证。

### 3. Effect.gen + yield*：拆盒子

先理解一个关键点：**Effect 是个"盒子"，值装在盒子里**。

`Effect.succeed(10)` 不是 10，是一个"装着 10 的盒子"。你不能直接对盒子做运算--`Effect.succeed(10) + Effect.succeed(20)` 是没意义的，就像两个礼盒相加不等于里面礼物相加。

要把值拿出来用，就得**拆盒子**。`yield*` 就是拆盒子的操作：

```ts
const sum = Effect.gen(function* () {
  const a = yield* Effect.succeed(10)   // 拆盒子，拿出 10，赋给 a
  const b = yield* Effect.succeed(20)   // 拆盒子，拿出 20，赋给 b
  return a + b                          // a、b 是普通数字，可以相加
})
```

逐行读：
- `Effect.succeed(10)` 造了一个"装着 10 的盒子"
- `yield*` 把盒子拆开，把里面的 10 拿出来
- `const a = ...` 把拿出来的 10 存进变量 `a`
- 现在 `a` 是普通的数字 10，可以正常运算
- 最后 `return a + b`，30 被装进一个新的盒子，成为 `sum` 这个 Effect 的产出

**一句话记住**：`yield*` = 拆盒子。右边的 Effect 是盒子，`yield*` 拆开它、运行它、把里面的值拿出来给你用。

为什么需要 `Effect.gen` 和 `function*` 这套语法？因为"拆盒子"这个动作只能在 `Effect.gen(function* () { ... })` 内部用。你可以把 `Effect.gen(function* () {})` 当成一个"允许拆盒子的工作台"--在这个工作台里，你用 `yield*` 拆盒子、取值、加工，最后 `return` 一个值（自动装回盒子）。`function*` 的星号是 JS 的语法要求，不用深究，照着写就行。

为什么要这么绕，不直接给值？因为盒子（Effect）是延迟的描述--拆盒子的那一刻它才真正执行。这让你能控制"什么时候算"。上一节的延迟性就是这么来的：`Effect.gen` 造工作台时不执行，`runPromise` 时才真正开始拆盒子。

### 4. Effect.promise：把已有 Promise 包进 Effect

```ts
const readFile = Effect.promise(async () => {
  const config = await Bun.file("opencode.json").json()
  return config.model as string
})
```

我们已经有大量 Promise 代码（`fetch`、`Bun.file`）。`Effect.promise` 把它们桥接进 Effect 世界--接收一个返回 Promise 的函数，返回一个 Effect。这是从现有 Promise 代码迁移到 Effect 的关键桥梁：旧代码不用重写，包一层 `Effect.promise` 就能进 Effect 体系。

### 5. Effect.fail：失败也是描述

```ts
const boom = Effect.fail(new Error("故意失败"))
try {
  await Effect.runPromise(boom)
} catch (e) {
  console.log("fail 被 catch:", ...)
}
```

`Effect.fail` 创建一个"将来会失败"的描述。和 `succeed` 一样，创建时不执行，`runPromise` 时才真正失败（reject）。失败在 Effect 里不是"抛异常"而是"描述的一部分"--这让错误可以被类型化、被精确捕获（10.7 课细讲）。

### 6. 组合性：run 之前变换 Effect

```ts
const number = Effect.succeed(5)
const doubled = number.pipe(Effect.map((n) => n * 2))
console.log(await Effect.runPromise(doubled)) // 10
```

`.pipe(Effect.map(f))` 的意思："这个 Effect 跑完后，把结果再用 f 变换一下"。注意这是在 **run 之前**描述的--你拿着一个"产出 5 的 Effect"，变换成"产出 10 的 Effect"，但两步都没执行，直到 `runPromise`。

这是"描述而非执行"的真正威力：**你可以像处理数据一样处理"计算"**。一个 Effect 可以被 map、filter、组合、传递，全部在 run 之前完成。Promise 做不到这点--Promise 一创建就在跑了，你只能等它结束再处理结果。

## 教 debug：Effect 报错怎么读

Effect 程序出错时，错误信息比裸 Promise 丰富得多，但也更吓人。几个要点：

1. **fiber trace**：Effect 的错误会带一个"调用栈"（fiber trace），告诉你错误发生在哪个 `yield*`。长得像 `at SessionStore.get (src/...)`，读法和普通栈一样，从上往下找你自己的代码。
2. **`Effect.runPromise` 抛的是 Effect 的失败值**：如果你 `Effect.fail(new Error("x"))`，`runPromise` 会 reject 这个 Error，`try/catch` 能接住。
3. **卡住不返回**：如果 `runPromise` 一直 pending，多半是某个 `yield*` 等了一个永远不会完成的 Effect（比如等一个没人 resolve 的 promise）。打点 `console.log` 在 `yield*` 前后，定位卡在哪一步。
4. **想看 Effect 的结构**：`Console.log(effect)` 打出来的是 Effect 对象的内部结构（不太可读）。调试时别 log Effect 本身，log 它 run 出来的值。

## 对照 opencode

opencode 的 CLI 默认命令 handler（`packages/cli/src/commands/handlers/default.ts`，才 13 行）就是一个标准的 Effect.gen：

```ts
import { Effect } from "effect"
import { Daemon } from "../../services/daemon"

export default Runtime.handler(Commands, () =>
  Effect.gen(function* () {
    const daemon = yield* Daemon.Service              // 取服务（10.3 课讲）
    const transport = yield* daemon.transport()        // 调服务方法（返回 Effect）
    const { runTui } = yield* Effect.promise(() => import("../../tui"))  // 桥接动态 import
    yield* runTui(transport)                            // 执行
  }),
)
```

读这段代码：
- 整个 handler 是一个 `Effect.gen`，描述了"取 daemon 服务 -> 拿 transport -> 动态加载 TUI -> 跑 TUI"四步
- `yield* Daemon.Service` 取服务（下一课的主题）
- `yield* Effect.promise(() => import(...))` 用我们刚学的 `Effect.promise` 桥接动态 import
- 这些 `yield*` 串联起来，读起来像同步代码，但实际是异步的

opencode 里**几乎所有业务逻辑**都长这样：一个 `Effect.gen`，里面一串 `yield*`。学会读这种结构，就能读懂 opencode 的核心代码。

## 为什么"描述而非执行"这么重要

你可能想："不就是个 lazy 的 Promise 吗，至于搞这么复杂？"

关键在于 10.1 课的痛点。我们要做依赖注入--函数声明"我需要 config"，框架自动提供。这件事**必须在 run 之前完成**：

1. 你写了一个 Effect，里面 `yield* ConfigService`（声明需要 config 服务）
2. run 之前，你用 `Effect.provide(ConfigLayer)` 把 config 的实现"塞进"这个 Effect
3. `runPromise` 时，Effect 执行到 `yield* ConfigService`，从塞进去的实现里取出 config

如果 Effect 像 Promise 一样创建即执行，你根本没机会在"创建"和"执行"之间塞依赖。**正因为 Effect 是延迟的描述，你才能在 run 之前给它装配依赖**--这就是下一课 Service/Layer 的根基。

## 本课小结

1. **Effect 是延迟的计算描述**：像 PyTorch 计算图，先 build 后 run。创建不执行，`runPromise` 才执行。
2. **Effect.gen + yield\***：`yield*` 是"拆盒子"--运行右边的 Effect，把产出的值拿出来当普通值用。在 `Effect.gen` 工作台里串联多步。
3. **succeed / fail / promise**：分别包"成功值""失败""已有 Promise"成 Effect。
4. **组合性**：`.pipe(Effect.map(f))` 在 run 前变换 Effect，像处理数据一样处理计算。
5. **延迟性是依赖注入的前提**：正因为 run 前能装配，才能实现 Service/Layer。

---

下一步：[10.3 Service + Layer：依赖注入](../03-service-layer/01-service-layer.md) -- 把 10.1 的痛点用 Effect 解决：ConfigService 一处定义、全局取用、可替换。
