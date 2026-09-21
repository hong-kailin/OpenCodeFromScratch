# 17.4.1 Protocol 请求方向：LLMRequest → Body

> 对照代码：[openai-chat-protocol.ts](../../../packages/core/src/provider/openai-chat-protocol.ts)

## 通用请求表达意图

```ts
export interface LLMRequest {
  readonly modelID: string
  readonly messages: Message[]
  readonly tools: Tool[]
}
```

这份类型只表达项目想做什么：选择模型、发送历史消息、允许模型调用哪些工具。它没有规定外部 API
使用 `model` 还是 `model_id`、`messages` 还是 `input`。

可以把它类比为领域层 dataclass。领域对象先保存业务含义，再由 adapter 翻译成某个外部系统的格式。

## OpenAI Chat Body 是厂商语言

```ts
export interface OpenAIChatBody {
  readonly model: string
  readonly stream: true
  readonly messages: Message[]
  readonly tools: ReturnType<typeof toolToOpenAIFormat>[]
}
```

这里的字段选择都属于 OpenAI Chat Completions Protocol：

| 转换 | 协议决定 |
|---|---|
| `modelID -> model` | 厂商要求的模型字段名 |
| `stream: true` | 使用流式响应 |
| `messages -> messages` | 使用 Chat messages 格式 |
| `Tool -> function tool` | 使用 OpenAI 工具描述结构 |

`ReturnType<typeof toolToOpenAIFormat>` 会提取转换函数的返回类型。转换函数增加字段时，Body 类型会
自动同步，避免再手写一份容易过期的 interface。

## encodeRequest 做语义翻译

```ts
encodeRequest: (request) => ({
  model: request.modelID,
  stream: true,
  messages: request.messages,
  tools: request.tools.map(toolToOpenAIFormat),
})
```

项目内部 `Tool` 还包含真正执行工具的 `execute` 函数。LLM 不需要这个函数，只需要工具名、说明和
参数 JSON Schema，因此 `toolToOpenAIFormat` 只投影可发送的部分。

`encodeRequest` 与 `JSON.stringify` 也不是一件事：

- `encodeRequest`：从通用语义翻译成厂商语义；
- `JSON.stringify`：从 JavaScript 对象序列化成 HTTP body 字符串。

前者随 Protocol 变化，后者是通用传输步骤。

## Provider 怎样使用请求方向

```ts
const body = openAIChatProtocol.encodeRequest({
  modelID: config.modelID,
  messages,
  tools,
})

await fetch(url, {
  method: "POST",
  headers,
  body: JSON.stringify(body),
})
```

Provider 只提供通用输入，并发送翻译结果。以后换成 Responses Protocol 时，Provider 不需要自己把
`messages` 改成 `input`。

## 请求方向怎样 Debug

1. 打印 `encodeRequest` 的输入，确认通用 `LLMRequest` 是否正确；
2. 打印返回的 Body，确认字段名和工具结构；
3. Body 正确但服务端说 JSON 无效，再检查 `JSON.stringify` 后的字符串；
4. 404 应检查 Endpoint，401 应检查 Auth，不要把所有 HTTP 错误都归到 Protocol。

请求对象由自己的代码构造，当前使用 TypeScript interface 做编译期检查。响应来自不可信的网络，
为什么还需要运行时 Schema，将在下一篇响应方向中看到。
