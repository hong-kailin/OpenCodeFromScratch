# 14.2 用 Stream 重构 chatWithTools

> 对照代码：`src/provider/openai.ts`（重构后的实际代码）
> 对照 opencode：`llm/src/route/framing.ts` 的 `Framing.sse`（SSE 分帧用 `ProviderShared.sseFraming`，思路一致）

## 重构前：命令式 for await 循环

阶段 14 之前，`src/provider/openai.ts` 的 SSE 解析是一个命令式循环：

```typescript
const decoder = new TextDecoder()
let fullText = ""

for await (const chunk of response.body!) {
  const text = decoder.decode(chunk, { stream: true })

  for (const line of text.split("\n")) {
    if (!line.startsWith("data: ")) continue

    const data = line.slice(6)
    if (data === "[DONE]") continue

    const json = JSON.parse(data)
    const delta = json.choices[0]?.delta

    // 处理文本增量 + 工具调用增量...
  }
}
```

这段代码能跑，但问题在**结构**：
- 解码、拆行、过滤、解析、处理 delta 全混在两层 for 循环里
- 每一步都改同一个循环体，拆不开、复用不了
- 想加"跳过空行"？改循环。想测"SSE 解析"？没有独立的函数可测

## 重构后：一条 Stream 管线

我们把"原始字节 → 解析好的 delta"做成一条 Stream 管线，每步只做一件事：

```typescript
const sseDeltaStream = Stream.fromAsyncIterable(
  response.body, // ReadableStream<Uint8Array>，也是 AsyncIterable
  (cause) => new Error(`读取流失败: ${String(cause)}`),
).pipe(
  Stream.map((chunk) => decoder.decode(chunk, { stream: true })), // 1. 字节 → 文本
  Stream.flatMap((text) => Stream.fromIterable(text.split("\n"))), // 2. 文本 → 行
  Stream.filter((line) => line.startsWith("data: ")), // 3. 只要 data 行
  Stream.map((line) => line.slice(6)), // 4. 去 "data: " 前缀
  Stream.filter((data) => data !== "[DONE]"), // 5. 去结束标记
  Stream.map((data) => JSON.parse(data)), // 6. 解析成对象
)
```

管线长这样：

```
response.body (字节流)
    │  fromAsyncIterable
    ▼
Stream<Uint8Array>
    │  map(decoder.decode)        字节 → 文本
    ▼
Stream<string>（文本块）
    │  flatMap(split("\n"))       文本 → 每行一个元素
    ▼
Stream<string>（行）
    │  filter(startsWith "data: ")
    ▼
Stream<string>（data 行）
    │  map(slice(6))              去 "data: " 前缀
    ▼
Stream<string>（原始数据）
    │  filter(!== "[DONE]")
    ▼
Stream<string>（有效数据）
    │  map(JSON.parse)
    ▼
Stream<object>（delta 对象）  ← 消费
```

### 为什么要用 flatMap 而不是 map 来拆行？

`splilt("\n")` 把一个文本块变成**多个**行。`map` 要求一个输入对应**一个**输出；
`flatMap` 允许一个输入展开成**多个**输出（返回一个新的 Stream）。所以拆行必须用 `flatMap`：

```typescript
// map：一个文本块 → 一个元素（不行，我们要一行一个）
Stream.map((text) => text.split("\n"))        // ❌ 变成数组了

// flatMap：一个文本块 → 展开成多个行元素
Stream.flatMap((text) => Stream.fromIterable(text.split("\n"))) // ✅
```

## 消费：runForEach 驱动 + 闭包累积

管线是**惰性描述**——`runForEach` 消费时才真正拉取响应体。副作用（onChunk 回调、
累积 fullText / toolCalls）留在消费端：

```typescript
let fullText = ""
const toolCallsMap = new Map<number, { id: string; name: string; arguments: string }>()

await Effect.runPromise(
  Stream.runForEach(sseDeltaStream, (json) =>
    Effect.sync(() => {
      const delta = json.choices?.[0]?.delta

      // 1. 处理文本增量
      if (delta?.content) {
        onChunk(delta.content)
        fullText += delta.content
      }

      // 2. 处理工具调用增量（按 index 累积，arguments 分块拼接）
      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          const existing = toolCallsMap.get(tc.index)
          if (existing) {
            if (tc.function?.arguments) existing.arguments += tc.function.arguments
          } else {
            toolCallsMap.set(tc.index, {
              id: tc.id,
              name: tc.function?.name || "",
              arguments: tc.function?.arguments || "",
            })
          }
        }
      }
    }),
  ),
)
```

注意：这里的累积逻辑和重构前**一模一样**，变的只是"遍历"由谁驱动——从命令式的
`for await` 变成了 `Stream.runForEach`。副作用累积放在闭包里（`fullText`、
`toolCallsMap`），因为它们要跨多个 delta 累积，而 `map`/`filter` 是纯变换。

## 对比：重构前 vs 重构后

| | 重构前（for await） | 重构后（Stream） |
|---|---|---|
| 遍历驱动 | 手动 `for await` | `Stream.runForEach` |
| 每步逻辑 | 混在循环体里 | 独立组合子，各管一件事 |
| 加一步 | 改循环体 | 往 `.pipe()` 加一行 |
| 复用/测试 | 难以抽取 | 每步可独立复用、测试 |
| 惰性 | 循环一启动就拉取 | 消费才拉取 |

## 为什么副作用累积不放进管线

你可能想问：`fullText` 累积为什么不也用 `Stream.runFold`？

因为 `onChunk` 回调要求在**每个文本增量到达时**触发（TUI 才能逐字渲染），
而 `runFold` 是**全部拉完后**才给结果——满足不了"流式"需求。所以：
- **管线**：负责"字节 → delta"的纯变换
- **runForEach**：负责"逐增量"的副作用（onChunk + 累积）

两个职责分开，各司其职。

## 对照 opencode

opencode 的 SSE 解析也做了同样的抽象（`opencode/packages/llm/src/route/framing.ts`）：

> `Framing.sse`：UTF-8 decode the body, run the SSE channel decoder, drop empty /
> `[DONE]` keep-alives. Each emitted frame is the JSON `data:` payload.

它的 `Framing.sse.frame` 就是把"字节流 → 分帧"做成一条 Stream 变换
（`frame: (bytes) => Stream`），和我们的管线思路一致。opencode 更进一步：
把"分帧"（framing）从"协议解析"（protocol）里拆成独立的轴（Route 四轴之一），
这是阶段 18 的内容。

## 教 debug：重构后怎么排查问题

1. **JSON.parse 崩了**——管线里某一行 `JSON.parse` 失败会让整个 `runForEach` 失败。
   如果看到 `JSON.parse` 相关的报错，在 `Stream.map((data) => JSON.parse(data))` 前加
   一个 `Stream.tap((data) => debug(...))` 打印原始 data，看是哪一行坏了。
2. **一个字符都不输出**——检查 `fromAsyncIterable` 是否接对了（`response.body`），
   以及 `runForEach` 是否真的调用了（忘调就是什么都不发生，惰性）。
3. **中文字符乱码**——`decoder.decode(chunk, { stream: true })` 的 `{ stream: true }`
   不能丢：它处理跨块的多字节字符。丢了会在块边界把 UTF-8 切坏。

## 跑一下

```bash
bun run src/stream-demo.ts        # 14.1 的基础演示
bun run src/index.ts run "你好"    # 实际用重构后的 provider 对话（CLI）
bun run src/tui/agent.tsx         # TUI 流式输出（验证 onChunk 仍正常工作）
```

验证点：流式输出逐字到达（说明 onChunk 驱动的管线正常）、工具调用正常、
`--debug` 模式下 SSE 日志结构清晰。

## 下一步

[14.3 阶段验收](../03-review/01-review.md) —— 工程思维总结 + 验收清单。
