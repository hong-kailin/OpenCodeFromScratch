# 10.2 Effect 是什么

> 本课拆成 4 个文件，这是第 1 个。先搞懂 Effect 到底是什么、怎么跑起来。

## 用 PyTorch 类比

你一定用过 PyTorch。在 PyTorch 里，你写 `y = torch.matmul(x, w)` 时，它不是立刻算出结果，而是**先把计算步骤记录下来**。你反复操作，步骤越攒越多，但什么都没真算。直到你触发前向传播，整张图才按顺序跑起来，产出真实数值。

Effect 是一模一样的思路：

- **写 Effect** = 记录"将来要做什么"。什么都不执行。
- **run Effect** = 触发执行，按记录的步骤跑，产出结果。

为什么要先记录后执行？因为"记录"（描述）可以组合、变换、传递。下一课的 Service/Layer 就建立在这之上--你在 run 之前能给 Effect 塞依赖。

## 先认识两个英文名词

后面会反复用到，先记住意思：

- **succeed**：英文"成功"的意思。`Effect.succeed(42)` = "一个将来会成功产出 42 的 Effect"。
- **runPromise**：run（运行）+ Promise（承诺）。`Effect.runPromise(effect)` = "运行这个 Effect，拿到结果"。

## 第一个 Effect 程序

看 `src/effect-demo.ts` 第 1 段：

```ts
const answer = Effect.succeed(42)
// 到这里什么都没发生，answer 只是个"将来产出 42"的描述

const answerResult = await Effect.runPromise(answer) // run，拿到 42
```

逐行解释：

**第 1 行** `const answer = Effect.succeed(42)`
- `const` 是声明变量，和 Python 的 `answer = ...` 一样，只是前面加个 `const`
- `Effect.succeed(42)` 把 42 装进一个 Effect 盒子。`answer` 不是 42，是"将来产出 42 的 Effect"
- 这行执行完，什么计算都没发生，只是造了个描述

**第 3 行** `const answerResult = await Effect.runPromise(answer)`
- `Effect.runPromise(answer)` 真正执行 answer 这个 Effect，返回结果
- `await` 是"等它完成"的意思--等 runPromise 跑完，把结果赋给 `answerResult`
- `await` 是 JavaScript 的关键字，Python 里没有完全对应的，但意思就是"等右边的事干完，拿结果"

跑完后 `answerResult` 就是 42。

## succeed 的参数

`succeed` 只接收**一个参数**，但这个参数可以是任何东西：

```ts
Effect.succeed(42)                          // 数字
Effect.succeed("hello")                     // 字符串
Effect.succeed({ name: "Alice", age: 30 })  // 对象（多个值用对象包）
Effect.succeed([1, 2, 3])                   // 数组
```

装进去什么，run 出来就是什么。

### 为什么要用 succeed 包？直接用值不行吗？

因为 Effect 世界里一切都得是 Effect（盒子）。后面会学到 `yield*`，它只能拆 Effect，不能拆普通值。如果你的函数需要返回一个 Effect（因为调用方会用 `yield*` 接收），但值已经现成了（不用异步、不用计算），就用 `succeed` 包一下。

10.3 课的 ConfigService 就有这个场景：config 已经缓存好了，但调用方用 `yield*` 接收，所以用 `Effect.succeed(config)` 包成 Effect。

**一句话：`succeed` 就是把普通值"翻译"成 Effect 世界的东西。**

## 延迟性：创建 ≠ 执行

这是 Effect 最重要的特性。看 demo 第 2 段的输出顺序：

```
2a. 即将创建 Effect（注意：里面那行日志此刻不该打印）
2c. Effect 已创建，但还没 run，所以 2b 还没打印
2b. 这行在 Effect 真正执行时才打印！
2d. run 完成: lazy result
```

注意 **2b 排在 2c 后面**。代码里 2b 写在 2a 之后、2c 之前，但实际打印却在 2c 之后。因为 `Effect.gen` 的函数体在创建时不执行，只有 `runPromise` 调用时才执行。

**创建只是写描述，run 才真正执行。** 这就是"延迟性"。

## 本节小结

1. **Effect 是延迟的计算描述**：像 PyTorch 计算图，先记录后执行
2. **succeed**：把一个值装进 Effect 盒子。只收一个参数，但可以是任何类型
3. **runPromise**：真正执行 Effect，拿结果。配合 `await` 等它完成
4. **延迟性**：创建不执行，run 才执行

---

下一步：[Effect.gen 与 yield*：拆盒子](./02-gen-yield.md)
