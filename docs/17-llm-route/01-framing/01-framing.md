# 17.1 先抽出 Framing：网络 chunk 不是事件边界

> 配套代码：
> [framing.ts](../../../packages/core/src/provider/framing.ts)、
> [framing-demo.ts](../../../packages/core/src/provider/framing-demo.ts)、
> [openai.ts](../../../packages/core/src/provider/openai.ts)

这一节只处理四轴中的 **Framing**：把连续网络字节切成完整 SSE frame。Endpoint、Auth 和
Protocol 都不改，程序对外行为也不改。

## 先复现真正的问题

当前 `openai.ts` 对每个网络 chunk 执行：

```ts
Stream.map((chunk) => decoder.decode(chunk, { stream: true })),
Stream.flatMap((text) => Stream.fromIterable(text.split("\n"))),
```

这段代码暗含了一个错误假设：**一次收到的网络 chunk 恰好在换行处结束。**

假设服务器发送一个完整 SSE 事件：

```text
data: {"choices":[{"delta":{"content":"你好"}}]}

```

TCP/HTTP 只保证字节顺序，不保证一次交付一整行。运行时完全可能分三次收到：

```text
chunk 1: data: {"choices":[{"del
chunk 2: ta":{"content":"你
chunk 3: 好"}}]}

```

旧管线会分别 `split("\n")`。第一块没有换行，却仍会立刻产生半行；它以 `data: ` 开头，
所以继续流到 `JSON.parse`，最终得到 `Unexpected end of JSON input`。网络换一种切块方式，
同一份响应可能成功也可能失败，这就是问题难以稳定复现的原因。

`TextDecoder(..., { stream: true })` 只能保存被切开的 UTF-8 字符。例如“你”的三个字节分属
两个 chunk 时，它不会产生乱码；它不知道 SSE 的空行规则，所以不能保存半行或半个事件。

## 用 demo 控制 chunk 边界

真实网络的切块不可预测，demo 会主动把 JSON 和“你”的 UTF-8 字节从中间切开，再把这些字节交给
Framing，检查它能否还原完整字符串。这样可以分别观察 SSE 事件状态和字符解码状态是否跨 chunk
保存。

这里没有引入 `bun:test`，也没有 `describe`、`test`、`expect`。它就是一个普通 TypeScript
程序：准备输入、运行函数、打印输出，结果不对就 `throw new Error(...)`。详细阅读方法见
[如何运行和读懂 Framing demo](./02-framing-demo.md)。

## 定义 Framing 边界

Framing 的接口只有一个转换：

```ts
export interface Framing<Frame> {
  readonly id: string
  readonly frame: (bytes: Stream.Stream<Uint8Array, LLMError>) => Stream.Stream<Frame, LLMError>
}
```

用 Python 类型理解，它大致是 `AsyncIterator[bytes] -> AsyncIterator[Frame]`。输入流和输出流的
元素数量没有一一对应关系：三个 chunk 可能组成一个 frame，一个 chunk 也可能
包含多个 frame。`Frame` 保留为泛型，因为 SSE 输出文本，而 AWS event-stream 会输出二进制事件。

## SSE Framing 如何工作

当前实现把职责串成四步：

```ts
bytes.pipe(
  Stream.decodeText(),
  Stream.pipeThroughChannel(Sse.decode()),
  Stream.catchTag("Retry", () => Stream.empty),
  Stream.filter((event) => event.data.length > 0 && event.data !== "[DONE]"),
  Stream.map((event) => event.data),
)
```

数据依次从 `Uint8Array chunk` 变成跨 chunk 解码的文本、按空行组成的 SSE Event，最后成为
有效事件的 `data` 字符串。`Sse.decode()` 是 Effect 提供的有状态 decoder：它会保存尚未结束的
行和事件，直到读到空行才输出；也能正确处理 `event:`、`id:` 和多行 `data:`。

SSE 的 `retry:` 是让客户端等待后重连的控制指令。当前项目还没有重连机制，所以暂时忽略它；
这与参考源码当前的处理一致。

## 为什么这里不做 `JSON.parse`

Framing 只回答“边界在哪里”，不回答“里面是什么意思”。同一份 SSE Framing 可以承载：

- OpenAI Chat 的 `choices[0].delta`；
- OpenAI Responses 的 `response.output_text.delta`；
- Anthropic 的 `content_block_delta`。

如果在 Framing 中读取 `choices`，它就会重新和 OpenAI Chat Protocol 绑死。因此
`sseFraming.frame(...)` 输出 `string`，`JSON.parse` 暂时留在 `openai.ts`；等后面的 Protocol
一节再把 JSON 校验和事件语义一起移走。

Provider 现在只负责接线：

```ts
const byteStream = Stream.fromAsyncIterable(
  response.body,
  (cause) => new LLMError({ message: `读取流失败: ${String(cause)}` }),
)
const sseDeltaStream = sseFraming.frame(byteStream).pipe(
  Stream.map((data) => JSON.parse(data)),
)
```

## 教 Debug：怎样判断坏在 Framing 还是 Protocol

- `JSON.parse` 报 `Unexpected end`：在它前面打印 `data`。若是半截 JSON，检查 Framing；若是完整但
  非法的 JSON，检查服务端响应或 Protocol。
- 中文出现 `�`：在 `decodeText` 前后打印字节和文本，通常是解码时没有保留跨块状态。
- 一直没有输出：SSE 事件必须用空行结束。检查原始 fixture 是否以 `\n\n` 或 `\r\n\r\n` 收尾。
- 真实请求偶尔失败：先用 demo 固定输入字节和切分位置，排除 API、认证和模型的影响。

运行验证：

```bash
bun run packages/core/src/provider/framing-demo.ts
bun run typecheck
```

预期看到两个场景的 chunk 长度、Framing 输出和“结果符合预期”，最后类型检查通过。

## 对照真实 opencode

真实入口是 `opencode/packages/llm/src/route/framing.ts`。它的 `Framing<Frame>` 同样接收字节 Stream
并输出 frame Stream；SSE 实现委托给 `protocols/shared.ts` 中的 `sseFraming`。我们当前把最小实现
暂放在 `core/provider`，等 Route 四轴都跑通后再一起拆进独立的 `packages/llm`。

这一节只建立了第一个可组合边界。下一节再根据当时的代码选择 Endpoint 或 Auth，不提前实现。
