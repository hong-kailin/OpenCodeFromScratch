# 10.2 调试、对照 opencode 与小结

> 第 4 个文件。前三节学了 Effect 基础，这节讲怎么调试、对照 opencode 怎么用、总结。

## 教 debug：Effect 报错怎么读

Effect 程序出错时，错误信息比普通代码丰富但也更吓人。几个要点：

1. **fiber trace**：Effect 的错误会带一个调用栈，告诉你错误发生在哪个 `yield*`。长得像 `at SessionStore.get (src/...)`，读法和普通栈一样，从上往下找你自己的代码。

2. **runPromise 抛的是失败值**：如果你 `Effect.fail(new Error("x"))`，`runPromise` 会抛出这个 Error，用 `try/catch` 能接住。

3. **卡住不返回**：如果 `runPromise` 一直不返回，多半是某个 `yield*` 等了一个永远不会完成的 Effect。打点 `console.log` 在 `yield*` 前后，定位卡在哪一步。

4. **别 log Effect 本身**：`console.log(effect)` 打出来的是 Effect 对象的内部结构，不太可读。调试时 log 它 run 出来的值，不是 Effect 本身。

## 对照 opencode

opencode 的 CLI 默认命令（`packages/cli/src/commands/handlers/default.ts`，才 13 行）就是一个标准的 Effect.gen：

```ts
import { Effect } from "effect"
import { Daemon } from "../../services/daemon"

export default Runtime.handler(Commands, () =>
  Effect.gen(function* () {
    const daemon = yield* Daemon.Service              // 取服务（10.3 课讲）
    const transport = yield* daemon.transport()        // 调服务方法
    const { runTui } = yield* Effect.promise(() => import("../../tui"))  // 桥接动态 import
    yield* runTui(transport)                            // 执行
  }),
)
```

现在你能读懂这段了：
- 整个 handler 是一个 `Effect.gen`，里面一串 `yield*` 串联四步
- `yield* Daemon.Service`：取服务（下一课的主题）
- `yield* Effect.promise(...)`：用我们刚学的 `Effect.promise` 桥接动态 import
- 每个 `yield*` 都等前一步完成才往下走

opencode 里几乎所有业务逻辑都长这样：一个 `Effect.gen`，里面一串 `yield*`。学会读这种结构，就能读懂 opencode 的核心代码。

## 为什么"延迟性"这么重要

你可能想："不就是 lazy 的 Promise 吗，至于搞这么复杂？"

关键在于 10.1 课的痛点。我们要做依赖注入--函数声明"我需要 config"，框架自动提供。这件事**必须在 run 之前完成**：

1. 你写了一个 Effect，里面 `yield* ConfigService`（声明需要 config 服务）
2. run 之前，你用 `Effect.provide(configLayer)` 把 config 的实现塞进这个 Effect
3. `runPromise` 时，Effect 执行到 `yield* ConfigService`，从塞进去的实现里取出 config

如果 Effect 像 Promise 一样创建即执行，你根本没机会在"创建"和"执行"之间塞依赖。**正因为 Effect 是延迟的描述，你才能在 run 之前给它装配依赖**--这就是下一课 Service/Layer 的根基。

## 本课小结

1. **Effect 是延迟的计算描述**：像 PyTorch 计算图，先记录后执行。创建不执行，runPromise 才执行
2. **succeed**：把值装进 Effect 盒子。只收一个参数，可以是任何类型
3. **yield\***：等 Effect 执行完 + 拆出里面的值。只能在 `Effect.gen(function* () {})` 里用
4. **function\***：带星号的函数，允许用 `yield*`。对照 Python 的 `def` + `yield`
5. **Effect.promise**：把已有的 async/await 代码包进 Effect，旧代码不用重写
6. **Effect.fail**：把失败装进 Effect，失败是描述的一部分
7. **.pipe(Effect.map(f))**：run 之前变换结果，像处理数据一样处理计算
8. **延迟性是依赖注入的前提**：run 前能装配依赖，才能实现 Service/Layer

---

下一步：[10.2.5 Python 的 yield：Effect 的底层机制](../02b-effect-internals/01-python-yield.md) -- 先补 Python yield 基础，再看 Effect 内部原理。
