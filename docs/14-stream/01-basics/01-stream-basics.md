# 14.1 Stream 基础：惰性拉取式异步序列

> 对照代码：`src/stream-demo.ts`（可运行的完整演示）

## 为什么要学 Stream

回顾 `src/provider/openai.ts` 现在的流式处理——一个命令式的 `for await` 循环：

```typescript
for await (const chunk of response.body!) {
  const text = decoder.decode(chunk, { stream: true })
  for (const line of text.split("\n")) {
    if (!line.startsWith("data: ")) continue
    // ...处理
  }
}
```

它能跑，但有两个问题：
1. **逻辑混在一起**：解码、拆行、过滤、解析全在一层层的循环里，拆不开、复用不了
2. **不可组合**：想加一步"跳过空行"？改循环。想复用"SSE 解析"？抄一遍

Stream 提供第三种思路：把"流"本身当作一个可以变换的值——像工厂流水线一样，
每步只做一件事，最后再消费。

## Stream 是什么

**Stream 是一串值的异步序列**。类比 Python 的 async generator：

```python
# Python: async generator
async def gen():
    yield 1
    yield 2
    yield 3

async for x in gen():
    print(x)
```

```typescript
// Effect Stream
const numbers = Stream.fromIterable([1, 2, 3])
await Effect.runPromise(
  Stream.runForEach(numbers, (n) => Effect.sync(() => process.stdout.write(`${n} `))),
)
```

核心思想：**一条 Stream 是数据流，你可以像搭流水线一样对它做变换，最后消费它**。

## 创建与消费：两个基础操作

### 创建：fromIterable

```typescript
const numbers = Stream.fromIterable([1, 2, 3, 4, 5]) // 数组 → Stream
```

### 消费：runForEach（"点火"）

```typescript
await Effect.runPromise(
  Stream.runForEach(numbers, (n) => Effect.sync(() => process.stdout.write(`${n} `))),
)
// 输出：1 2 3 4 5
```

`runForEach` 是"点火"——**到这里 Stream 才开始真正产生值**。它消费整条流，
对每个元素执行一个副作用（这里是打印）。

## 逐元素变换：map / filter / tap

```
Stream.map(f)    : 每个元素用 f 变换     [1,2,3] → [2,4,6]
Stream.filter(p) : 保留满足 p 的元素      [1..6] → [2,4,6]
Stream.tap(f)    : 对每个元素做副作用     （不改变元素，用于调试打日志）
```

看 demo 第 2 节：

```typescript
const doubled = Stream.fromIterable([1, 2, 3]).pipe(
  Stream.map((n) => n * 2), // 每个元素 ×2
)
// 输出：2 4 6
```

> 注意：`.pipe(Stream.map(...))` 里的 `Stream.map` 和 `Effect.map` 不同——**作用对象不同**。
> `Effect.map` 作用于一个 Effect（单值计算），`Stream.map` 作用于流里的**每个元素**。

## 链式组合：流水线

Stream 的威力在于**链式组装**。看 demo 第 3 节：

```typescript
const pipeline = Stream.fromIterable([1, 2, 3, 4, 5, 6]).pipe(
  Stream.filter((n) => n % 2 === 0), // 保留偶数：2, 4, 6
  Stream.map((n) => n * 10), // 变成：20, 40, 60
  Stream.tap((n) => Effect.sync(() => console.log(`经过 ${n}`))), // 调试日志
)
```

数据流长这样：

```
1,2,3,4,5,6 → [filter 偶数] → 2,4,6 → [map ×10] → 20,40,60 → [tap 日志] → 消费
```

和命令式 for 循环对比：这里**每一步只做一件事**，且顺序清晰。想加一步？
往 `.pipe()` 里加一行就行，不用动别的逻辑。

## 聚合：runFold

把整条流"折叠"成一个值（类比 Python 的 `functools.reduce`）。看 demo 第 4 节：

```typescript
const sum = await Effect.runPromise(
  Stream.runFold(
    Stream.fromIterable([1, 2, 3, 4, 5]),
    () => 0, // 初始值（beta 版本要求写成惰性函数）
    (acc, n) => acc + n, // 折叠函数：(累积值, 当前值) => 新累积值
  ),
)
// sum = 15
```

## fromAsyncIterable：接住网络响应体（14.2 的关键）

看 demo 第 5 节。为什么单独讲它：**网络响应体（`response.body`）就是异步可迭代对象**，
`fromAsyncIterable` 能把它接进 Stream 管线——这正是 14.2 重构 chatWithTools 的基础。

```typescript
const fromNetwork = Stream.fromAsyncIterable(
  fakeNetworkChunks(), // 任何 AsyncIterable（response.body 就是）
  (cause) => new Error(`读取流失败: ${String(cause)}`), // 读取出错时的处理
)
```

demo 里用 `runFold` 把分块的 "Hel" "lo " "World" 拼成 "Hello World"。

## 惰性：不消费就不执行（Stream 的灵魂）

看 demo 第 6 节，这是 Stream 和普通数组的本质区别：

```typescript
const lazy = Stream.fromIterable([1, 2, 3]).pipe(
  Stream.map((n) => {
    console.log(`[map 执行] ${n}`) // ← 注意这里有 log
    return n * 2
  }),
)

console.log("Stream 已创建") // ← 这一刻 map 还没执行！
// 输出顺序：
//   "Stream 已创建，但 map 还没执行（惰性！）"
//   "现在 runForEach 消费它："
//   [map 执行] 1
//   [map 执行] 2
//   [map 执行] 3
//   ...
```

**创建 Stream 只是"描述"，消费（`runForEach`/`runFold`）才真正执行。**
和 Effect 的"延迟计算"一脉相承——这让我们可以在消费前自由地 `pipe` 组合。

> 惰性的意义：构建一条 Stream 管线时不产生任何副作用，只有最终消费才拉取数据。
> 这保证了"描述逻辑"和"执行时机"分离，组合起来才安全。

## 教 debug：Stream 不输出怎么排查

刚接触 Stream 最容易踩的坑：

1. **创建了 Stream 但忘了消费**——`Stream.fromIterable([1,2,3])` 什么都不输出，因为没 `runForEach`/`runFold`。检查是否"点火"了。
2. **`runForEach` 里忘了包 `Effect.sync`**——回调必须是 `(n) => Effect...`，直接写 `console.log(n)` 类型会报错（回调要求返回 Effect）。
3. **卡住不动**——如果是从 `fromAsyncIterable` 创建的流卡住，通常是底层迭代器不结束。可以加 `Stream.tap` 在关键步骤打印日志，看数据流到哪一步断了。

## 跑一下

```bash
bun run src/stream-demo.ts
```

看 6 个节的输出，重点观察第 3 节（链式组装）和第 6 节（惰性）。

## 下一步

[14.2 用 Stream 重构 chatWithTools](../02-refactor/01-refactor.md) —— 把 `src/provider/openai.ts`
的两层 for 循环改成一条 Stream 管线。
