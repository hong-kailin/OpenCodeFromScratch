# 17.4.3 Protocol 响应方向：Frame → LLMEvent

> 对照代码：
> [protocol.ts](../../../packages/core/src/provider/protocol.ts)、
> [openai-chat-protocol.ts](../../../packages/core/src/provider/openai-chat-protocol.ts)、
> [openai.ts](../../../packages/core/src/provider/openai.ts)

## 响应方向要隐藏什么

修改前，Provider 直接读取：

```ts
const delta = json.choices?.[0]?.delta
```

它还按 `tool_calls[index]` 保存工具调用，并拼接分块到达的 `arguments`。这些都是 OpenAI Chat 的
响应规则。响应 Protocol 要把它们收进去，只向 Provider 交付项目通用事件。

```text
完整 SSE payload
  -> decodeFrame：JSON 解析 + 运行时 Schema 校验
  -> step：厂商事件 + 旧状态 -> 新状态 + 通用事件
  -> finish：流结束 -> 完整工具调用
```

## 为什么 interface 不够

TypeScript 类型会在程序运行后消失。给变量标注 `OpenAIChatEvent`，不能阻止服务器实际返回：

```json
{"choices":"不是数组"}
```

因此 `decodeFrame` 做两层运行时检查：

```ts
decodeFrame: (frame) => decodeOpenAIChatEvent(JSON.parse(frame))
```

`JSON.parse` 检查 JSON 语法，Effect Schema 继续检查字段结构和类型。可以类比 Python 中先
`json.loads`，再用 Pydantic model 校验外部数据。

## 通用 LLMEvent

上一节已经区分了 SSE event、VendorEvent 和 LLMEvent。这里继续看 OpenAIChatEvent 怎样被状态机翻译。

```ts
type LLMEvent =
  | { type: "text-delta"; text: string }
  | { type: "tool-call"; toolCall: ToolCall }
```

`type` 是可辨识联合的标签。判断 `event.type === "text-delta"` 后，TypeScript 知道这一支一定有
`text`；另一支一定有 `toolCall`。

Responses 或 Anthropic 的原始 event 即使完全不同，也能翻译成相同的 `LLMEvent`。Provider 因而只
认识项目语言。

## 为什么需要 State

工具参数可能分成多个 frame：

```text
frame 1: index=0, id=call_1, name=read, arguments={"path":
frame 2: index=0,                            arguments="README.md"}
```

第二帧没有 `id` 和 `name`，单独无法生成完整工具调用。Protocol 用 `OpenAIChatState.toolCalls` 保存
片段，并让 `step` 显式返回新状态：

```ts
step(state, vendorEvent) -> { state, llmEvents }
```

这就是最小状态机：根据“旧状态 + 当前输入”计算“新状态 + 输出”。这里不需要 class，也不需要额外
框架。

## 为什么在 finish 发布工具调用

第一帧到达时无法知道后面是否还有参数片段。若立刻输出，消费方可能拿到半截 JSON。`finish(state)`
以流结束为边界，再把积累结果转成完整 `ToolCall`。

当前简化版假设正常结束时参数已经完整。真实 opencode 还会结合生命周期事件、结束原因和错误处理
判断调用是否完成，后续演进到相应能力时再加入。

## Provider 最终只消费通用事件

```ts
if (event.type === "text-delta") {
  onChunk(event.text)
  fullText += event.text
  return
}

toolCalls.push(event.toolCall)
```

如果文本错误，观察 `step` 产出的 llmEvents；如果工具参数缺字，观察 step 前后的 state；如果连完整
payload 都没有，回到 Framing 排查。每个边界对应一种问题，Debug 时不必再从整个 Provider 猜起。
