# 10.2a Effect 是什么：延迟的计算描述

> 对照代码：`src/effect-demo.ts` 第 1-2 节

## 核心概念：描述 ≠ 执行

Effect 不是 Promise。Promise 创建就开始执行，Effect 创建时**什么都不发生**——它只是一份"将来要做什么"的描述。

```
Promise:  创建 → 立即执行 → 拿结果
Effect:   创建 → 什么都不发生 → 调用 runPromise → 才执行 → 拿结果
```

Python 类比：PyTorch 的计算图。你先 `torch.add(a, b)` 构建图，此时没有计算发生；`session.run()` 才真正执行。

## 最简例子

```typescript
import { Effect } from "effect"

const answer = Effect.succeed(42)
// 到这里什么都没发生。answer 只是一个"描述"。

const result = await Effect.runPromise(answer)
// 现在才执行：把 42 从盒子里拿出来
console.log(result) // 42
```

`Effect.succeed(x)` 创建一个描述："我会产出 x"。`runPromise` 是"启动开关"——按下才真正执行。

## 延迟性证明

用 `console.log` 亲手验证创建 ≠ 执行：

```typescript
console.log("A. 即将创建 Effect")

const lazy = Effect.gen(function* () {
  console.log("B. 这行在 Effect 执行时才打印！")
  return "done"
})

console.log("C. Effect 已创建，但 B 还没打印")

await Effect.runPromise(lazy)

console.log("D. run 完成")
```

**输出顺序**：A → C → B → D

B 排在 C 后面，证明 `Effect.gen` 的函数体在 `runPromise` 时才执行，创建时一个字都没跑。

## 为什么需要"描述而非执行"

因为描述可以**组合**。在 run 之前，你可以对 Effect 做各种变换：

```typescript
const effect = Effect.succeed(5)
  .pipe(Effect.map(n => n * 2))    // 还没跑，只是描述"先产出 5，再乘 2"
  .pipe(Effect.map(n => n + 1))    // 还没跑，加一句"再 +1"

await Effect.runPromise(effect) // 现在跑：5 → 10 → 11
```

如果 Effect 创建时就执行了，你就没法在 run 前做变换——因为值已经算出来了。

## Effect.succeed vs Effect.fail

```typescript
Effect.succeed(42)           // 描述"我会成功，产出 42"
Effect.fail(new Error("x"))  // 描述"我会失败，原因是 x"
```

`fail` 创建时也不执行——它只是一份"将来会失败"的描述。`runPromise` 遇到 `fail` 会 reject，可以用 `try/catch` 接住。

## 跑一下

```bash
bun run src/effect-demo.ts
```

看第 1-2 节的输出，验证延迟性。