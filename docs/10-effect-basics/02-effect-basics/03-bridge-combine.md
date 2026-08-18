# 10.2c 桥接与组合：promise / map / pipe

> 对照代码：`src/effect-demo.ts` 第 5-7 节

## Effect.promise：把 Promise 桥接进 Effect

你已经有大量 Promise 代码（fetch、Bun.file、Bun.write）。重写成本太高。

**Effect.promise 是桥梁**：把已有的 Promise 函数包进 Effect 世界。

```typescript
const readFile = Effect.promise(async () => {
  const config = await Bun.file("opencode.json").json()
  return config.model as string
})

// 现在 readFile 是一个 Effect，可以在 gen 里 yield*
const model = await Effect.runPromise(readFile)
```

`Effect.promise` 的参数是一个 `async () => { ... }` 函数——里面可以写任意 await 代码，正常用 Promise。

## .pipe(Effect.map(...))：在 run 前变换

因为 Effect 是描述，你可以在 run 之前对它做变换：

```typescript
const doubled = Effect.succeed(5)
  .pipe(Effect.map(n => n * 2))

await Effect.runPromise(doubled) // 10
```

`.pipe(fn)` 是"把左边的值传给右边的函数"——`obj.pipe(fn)` 等价于 `fn(obj)`。

**map 链式变换**：多步变换串联，全部在 run 前描述好：

```typescript
const pipeline = Effect.succeed(3)
  .pipe(Effect.map(n => n + 10))   // 13
  .pipe(Effect.map(n => n * 2))    // 26
  .pipe(Effect.map(n => `结果 ${n}`))

await Effect.runPromise(pipeline)  // "结果 26"
```

## runSync vs runPromise

| 方法 | 返回值 | 适用场景 |
|------|--------|---------|
| `runPromise` | `Promise<T>` | 包含异步操作（fetch、文件 IO） |
| `runSync` | `T`（直接） | 纯同步的 Effect（succeed + map 链） |

```typescript
Effect.runSync(Effect.succeed(100))  // 直接返回 100
Effect.runSync(readFile)              // 报错！readFile 里有异步操作
```

简单规则：**效果里没用 `Effect.promise` 就用 `runSync`，用了就用 `runPromise`**。

## 组合：gen 里 yield* Promise 桥接的 Effect

把前面学的串起来：

```typescript
const combined = Effect.gen(function* () {
  const x = yield* Effect.succeed(10)       // 同步
  const modelName = yield* readFile          // 异步（读文件）
  return `${modelName} 结果是 ${x * 2}`
})
```

gen 里混用同步和异步 Effect，`yield*` 统一拆盒子。

## 跑一下

```bash
bun run src/effect-demo.ts
```

看第 5-8 节的输出。