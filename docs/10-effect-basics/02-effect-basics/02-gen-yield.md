# 10.2 Effect.gen 与 yield*：拆盒子

> 第 2 个文件。上节学了 succeed 装盒子、runPromise 执行。这节学怎么把盒子里的值拿出来用。

## 盒子类比

上节说 `Effect.succeed(10)` 把 10 装进盒子。但装进去的值不能直接用--你不能对盒子做运算：

```ts
Effect.succeed(10) + Effect.succeed(20)  // 没意义！盒子不能相加
```

就像两个礼盒相加不等于里面礼物相加。要把值拿出来用，就得**拆盒子**。

## yield*：等 + 拆

`yield*` 就是拆盒子的操作。但要注意，它做**两件事**：

```ts
const sum = Effect.gen(function* () {
  const a = yield* Effect.succeed(10)   // 等 succeed 跑完，拆出 10，赋给 a
  const b = yield* Effect.succeed(20)   // 等 succeed 跑完，拆出 20，赋给 b
  return a + b                          // a、b 是普通数字，可以相加
})
```

逐行读：
- `yield* Effect.succeed(10)`：先**等**右边的 Effect 执行完（这里 succeed 很快），再**拆**出里面的 10
- `const a =` 把拆出来的 10 存进变量 `a`
- 现在 `a` 是普通数字 10，可以正常运算
- `return a + b`：30 被自动装进一个新的盒子，成为 `sum` 的产出

**`yield*` 既是"等待"又是"拆盒子"**：
- **等**：右边的 Effect 没跑完，就不往下走。如果右边是读文件这种耗时操作，会一直等到读完
- **拆**：Effect 跑完后，把产出的值拿出来给你用

## Effect.gen：允许拆盒子的工作台

`yield*` 不能随便用，只能在 `Effect.gen(function* () { ... })` 里面用。`Effect.gen` 是一个"工作台"--在这个工作台里，你用 `yield*` 拆盒子、取值、加工，最后 `return` 一个值（自动装回盒子）。

## function* 是什么

你可能注意到 `function*` 有个星号 `*`。这是什么？

它是 JavaScript 的一种特殊函数写法。对照 Python：

| Python | JavaScript | 含义 |
|--------|-----------|------|
| `def f(): return 1` | `function f() { return 1 }` | 普通函数 |
| `def f(): yield 1` | `function* f() { yield 1 }` | 生成器函数（能用 yield） |

`function*` 里的星号就相当于 Python 里让函数能用 `yield` 的标记。**没有 `*`，就不能用 `yield*`**。Effect 需要 `yield*` 来拆盒子，所以必须用 `function*`。

你不用理解生成器的全部机制，只要记住：**`function*` 是允许用 `yield*` 的函数，`Effect.gen` 里必须这么写**。

## 为什么要这么绕？

你可能会问：为什么不直接给值，非要装盒子再拆？

因为盒子（Effect）是延迟的描述--拆盒子的那一刻它才真正执行。这让你能控制"什么时候算"。上节的延迟性就是这么来的：`Effect.gen` 造工作台时不执行，`runPromise` 时才真正开始拆盒子。

而且，如果右边是耗时操作（比如读文件），`yield*` 会等它完成。这样多步操作就能按顺序串联起来，读起来像同步代码，但实际是异步的。

## 本节小结

1. **Effect 是盒子**：值装在里面，不能直接用
2. **yield\* 做 两件事**：**等** Effect 执行完 + **拆**出里面的值
3. **Effect.gen**：允许用 `yield*` 的工作台
4. **function\***：带星号的函数，允许用 `yield*`。对照 Python 的 `def` + `yield`

---

下一步：[桥接已有代码与组合变换](./03-bridge-combine.md)
