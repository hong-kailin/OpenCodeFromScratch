# 10.2d Debug 与小结

> 对照代码：`src/effect-demo.ts` 第 9 节

## Debug：fiber trace

Effect 的报错信息包含 **fiber trace**（类似 Python 的 traceback），告诉你错误发生在调用链的哪一层。

```typescript
const failInGen = Effect.gen(function* () {
  const a = yield* Effect.succeed(1)
  const b = yield* Effect.fail(new Error("这里出错了"))
  return a + b
})

try {
  await Effect.runPromise(failInGen)
} catch (e) {
  console.log(e.message)  // "这里出错了"
  console.log(e.stack)     // 包含 fiber trace，定位到具体行
}
```

## Debug 技巧

1. **Effect 不执行？** 检查是否忘了 `runPromise`。Effect 创建不执行，必须 run。
2. **yield\* 报错？** 检查是否在 `Effect.gen` 外面用了 `yield*`。`yield*` 只能在 gen 里用。
3. **runSync 报错？** 检查 Effect 里是否包含异步操作（`Effect.promise`）。含异步的只能用 `runPromise`。
4. **用 console.log 打点**：在 gen 体里插入 `console.log`，观察执行顺序：

```typescript
const debug = Effect.gen(function* () {
  console.log("1. 开始")
  const x = yield* Effect.succeed(42)
  console.log("2. x =", x)
  const y = yield* Effect.promise(async () => {
    console.log("3. 异步操作")
    return 100
  })
  console.log("4. y =", y)
  return x + y
})
```

## 小结

| 概念 | 代码 | 说明 |
|------|------|------|
| 创建成功值 | `Effect.succeed(x)` | 描述"我会产出 x" |
| 创建失败 | `Effect.fail(err)` | 描述"我会失败" |
| 串联多步 | `Effect.gen(function* () { ... })` | 工作台，允许 yield* |
| 拆盒子 | `yield* effect` | 运行 Effect，拿出值 |
| 桥接 Promise | `Effect.promise(async () => ...)` | 把 Promise 代码包进 Effect |
| 在 run 前变换 | `.pipe(Effect.map(fn))` | 组合链式变换 |
| 执行（异步） | `await Effect.runPromise(effect)` | 点火，跑异步 Effect |
| 执行（同步） | `Effect.runSync(effect)` | 点火，跑纯同步 Effect |

## 核心思想

> Effect 是"计算的描述"，不是"计算的执行"。组合性来自延迟——先描述好要做什么，再统一执行。

## 下一步

阶段 11：Service + Layer——用依赖注入解决"参数到处传"的痛点。