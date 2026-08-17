# 10.2 桥接已有代码与组合变换

> 第 3 个文件。前两节学了 Effect 基础。这节学三个工具：把已有代码包进 Effect、处理失败、变换结果。

## Effect.promise：把已有异步代码包进 Effect

我们之前 9 个阶段写了大量异步代码，比如读文件：

```ts
const config = await Bun.file("opencode.json").json()
```

这些代码用的是 JavaScript 的 `async`/`await` 机制。现在要迁移到 Effect，总不能全部重写。`Effect.promise` 就是桥梁--把已有的异步代码包一层，变成 Effect：

```ts
const readFile = Effect.promise(async () => {
  const config = await Bun.file("opencode.json").json()
  return config.model as string
})
```

逐个解释新东西：

- `async () => { ... }`：这是一个**箭头函数**。`async` 表示"这个函数里可以用 `await`"。对照 Python 就是 `async def f(): ...`
- `=>` 是箭头函数的标志。`() => { ... }` 等价于 Python 的 `def f(): ...`，只是写法不同
- `await Bun.file("opencode.json").json()`：`await` 是"等它完成"。等文件读完，拿到内容
- `return config.model as string`：返回 model 字段。`as string` 是告诉 TypeScript "这是字符串"

`Effect.promise` 接收这样一个 async 函数，返回一个 Effect。之后就能用 `yield*` 或 `runPromise` 来用了。**旧代码不用重写，包一层 `Effect.promise` 就进 Effect 体系。**

## Effect.fail：失败也是 Effect

`Effect.succeed` 是"成功的描述"，`Effect.fail` 是"失败的描述"：

```ts
const boom = Effect.fail(new Error("故意失败"))
try {
  await Effect.runPromise(boom)
} catch (e) {
  console.log("fail 被 catch:", e instanceof Error ? e.message : e)
}
```

逐个解释：

- `new Error("故意失败")`：创建一个错误对象。`Error` 是 JavaScript 内置的错误类型，`new` 是创建对象的关键字
- `Effect.fail(...)`：把错误装进 Effect，变成"将来会失败"的描述
- `try { ... } catch (e) { ... }`：和 Python 的 `try/except` 一样。`runPromise` 遇到 fail 会抛出错误，`catch` 接住
- `e instanceof Error ? e.message : e`：三目运算，对照 Python 的 `e.message if isinstance(e, Error) else e`

和 `succeed` 一样，`fail` 创建时不执行，`runPromise` 时才真正失败。

**为什么要把失败也做成 Effect？** 因为这样失败就是"描述的一部分"，可以被类型化、被精确捕获。比如你能写"只捕获配置错误、放过其他错误"。10.7 课细讲。

## .pipe(Effect.map(...))：run 之前变换结果

```ts
const number = Effect.succeed(5)
const doubled = number.pipe(Effect.map((n) => n * 2))
console.log(await Effect.runPromise(doubled)) // 10
```

逐个解释：

- `(n) => n * 2`：箭头函数，接收 `n`，返回 `n * 2`。对照 Python 的 `lambda n: n * 2`
- `Effect.map(...)`：对 Effect 的结果做变换。"这个 Effect 跑完后，把结果再用这个函数处理一下"
- `.pipe(...)`：把前面的东西传给后面的函数处理。`number.pipe(Effect.map(f))` 等价于 `Effect.map(number, f)`

整句意思：拿一个"产出 5 的 Effect"，变换成"产出 10 的 Effect"。但两步都没执行，直到 `runPromise`。

这是"描述而非执行"的威力：**你可以像处理数据一样处理"计算"**。在 run 之前变换、组合、传递 Effect。

## 本节小结

1. **Effect.promise**：把已有的 async/await 代码包进 Effect。旧代码不用重写
2. **Effect.fail**：把失败装进 Effect。失败是描述的一部分，不是抛异常
3. **.pipe(Effect.map(f))**：run 之前变换 Effect 的结果。f 是箭头函数，对照 Python lambda

---

下一步：[调试、对照 opencode 与小结](./04-debug-summary.md)
