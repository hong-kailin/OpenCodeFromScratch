# 17.4.2 Event 到底是什么

> 对照代码：
> [framing.ts](../../../packages/core/src/provider/framing.ts)、
> [protocol.ts](../../../packages/core/src/provider/protocol.ts)、
> [openai-chat-protocol.ts](../../../packages/core/src/provider/openai-chat-protocol.ts)、
> [route.ts](../../../packages/core/src/provider/route.ts)

在当前代码中，**event 表示流中已经发生的一件事**。例如“模型又生成了一段文本”或者“模型开始
调用 read 工具”。它是一条按顺序到达的消息，不是整个 LLM 调用的最终结果。

可以类比 Python generator：

```py
for event in model_stream:
    handle(event)
```

一次模型响应可能产生几十或几百个 event。消费方收到一个就处理一个，所以终端可以逐字显示，而不必
等整个回答完成。

## 先区分六个容易混淆的层次

同一段文本从网络到 Provider 会经历下面的变化：

```text
网络 chunk
  -> SSE event
  -> Frame
  -> VendorEvent
  -> LLMEvent
  -> ChatResult
```

它们不是六种叫法相同的东西：

| 层次 | 示例 | 谁负责 |
|---|---|---|
| 网络 chunk | 任意一段 `Uint8Array` | HTTP / 网络 |
| SSE event | `data: {...}\n\n` 表达的一条 SSE 消息 | Framing 内部 |
| Frame | `'{"choices":[...]}'` 字符串 | Framing 输出 |
| VendorEvent | `{ choices: [{ delta: ... }] }` | Protocol 解码 |
| LLMEvent | `{ type: "text-delta", text: "你" }` | Protocol 翻译 |
| ChatResult | `{ text: "你好", toolCalls: [...] }` | Provider 累积 |

## 网络 chunk 不是 event

网络只保证字节按顺序到达，不保证一次读取正好得到一条完整消息。一条 SSE event 可能被拆成三个
chunk，也可能两个 event 一起出现在一个 chunk 中。

所以 Framing 不能“每收到一个 chunk 就解析一次 JSON”。它要一直缓冲，直到 SSE 的空行边界出现，
才知道一条 SSE event 完整了。

## SSE event 和 Frame 的区别

服务器实际发送：

```text
data: {"choices":[{"delta":{"content":"你"}}]}

```

SSE event 包含 `data:`、换行边界，还可能包含 `event:`、`id:` 等 SSE 字段。当前 `sseFraming` 只取
其中的 `data`，所以它输出的 Frame 是：

```ts
'{"choices":[{"delta":{"content":"你"}}]}'
```

Frame 已经拥有完整边界，但仍是字符串，也还没有证明里面符合 OpenAI Chat 的结构。

## VendorEvent 是什么

`decodeFrame` 先执行 `JSON.parse`，再用 Effect Schema 校验，得到 `OpenAIChatEvent`：

```ts
const vendorEvent = protocol.response.decodeFrame(frame)
```

它叫 `VendorEvent`，因为 `choices[0].delta` 是厂商协议的语言。OpenAI Responses、Anthropic 都会有
不同的 VendorEvent。泛型使用这个名字，是为了明确它还不能直接交给 Provider。

## LLMEvent 是什么

Protocol 把不同厂商的事件翻译成项目内部统一的 `LLMEvent`：

```ts
type LLMEvent =
  | { type: "text-delta"; text: string }
  | { type: "tool-call"; toolCall: ToolCall }
```

它表达项目关心的事实：

- `text-delta`：模型新生成了一段文本；
- `tool-call`：模型给出了一个完整、可以执行的工具调用。

Provider 只消费 `LLMEvent`，因此不需要知道文本原来位于 `choices[0].delta.content`，也不需要知道
Anthropic 或 Responses 使用什么字段。

## 为什么不直接返回 ChatResult

如果 Protocol 直接等待并返回最终 `ChatResult`，中间的文本增量会被吃掉，终端无法实时显示；工具参数
的跨帧拼接、reasoning、usage 等信息也只能塞进一个越来越大的返回对象。

Event 把一次响应拆成按时间排序的小事实：上游持续产生，下游可以逐条显示、累计、记录或转发。
最终的 `ChatResult` 只是当前 Provider 对这些 `LLMEvent` 做的一种汇总。

## Event 与 State 怎样配合

并非每个 VendorEvent 都能立刻产生 LLMEvent。工具 arguments 可能分成多帧，Protocol 必须先更新
State；等流结束后，`finish(state)` 才输出完整的 `tool-call`。

```text
VendorEvent + 旧 State -> 新 State + 0..N 个 LLMEvent
```

所以 `step` 返回数组：一条厂商事件可能不输出事件，也可能输出一条或多条通用事件。

## 它不是后续的 Session 事件溯源

这里的 `LLMEvent` 是一次网络流中的临时消息，主要用于流式翻译和实时消费。后续阶段的 Session event
会持久化业务事实，用于恢复、revert 和重放。两者都描述“发生了什么”，但生命周期和用途不同，当前
不要把 `LLMEvent` 理解成数据库事件记录。
