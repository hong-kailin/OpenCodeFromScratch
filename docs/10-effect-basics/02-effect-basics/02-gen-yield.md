# 10.2b Effect.gen + yield*：拆盒子，串联多步

> 对照代码：`src/effect-demo.ts` 第 3 节

## "盒子"类比

把 Effect 想象成一个"盒子"——值装在里面，不能直接用。

```typescript
const box = Effect.succeed(10)  // 盒子，里面装着 10
// 你不能写 box + 5，因为 box 是盒子，不是数字
```

**yield\* 就是"拆盒子"**：运行右边的 Effect，把里面的值拿出来，变成普通值给你用。

**Effect.gen** 是"工作台"——只有在这个工作台里，你才能用 `yield*` 拆盒子。

## 串联多步

```typescript
const sum = Effect.gen(function* () {
  const a = yield* Effect.succeed(10)  // 拆盒子，拿到 10
  const b = yield* Effect.succeed(20)  // 拆盒子，拿到 20
  return a + b                          // a、b 是普通数字，可以直接算
})
```

`yield*` 做了三件事：
1. 运行右边的 Effect
2. 如果成功，拆开盒子，把值赋给左边的变量
3. 如果失败，**不赋变量**，直接向上传播错误（gen 函数体终止）

## 对照 Python

| Effect | Python |
|--------|--------|
| `Effect.gen(function* () { ... })` | `async def f(): ...` |
| `yield* someEffect` | `await someCoroutine` |
| `Effect.succeed(x)` | `return x`（但包在 Future 里） |
| `Effect.runPromise(e)` | `asyncio.run(e)` |

## 错误传播

如果 `yield*` 的 Effect 失败了，错误会自动向上传播，gen 体的后续代码不会执行：

```typescript
const failInGen = Effect.gen(function* () {
  const a = yield* Effect.succeed(1)
  const b = yield* Effect.fail(new Error("这里出错了"))
  return a + b  // 永远不会执行到这里
})
```

## 跑一下

```bash
bun run src/effect-demo.ts
```

看第 3 节和第 8 节的输出，验证 gen + yield* 串联多步的效果。