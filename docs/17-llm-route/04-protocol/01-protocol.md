# 17.4 Protocol：隔离 LLM API 的数据语义

> 配套代码：
> [protocol.ts](../../../packages/core/src/provider/protocol.ts)、
> [openai-chat-protocol.ts](../../../packages/core/src/provider/openai-chat-protocol.ts)、
> [openai.ts](../../../packages/core/src/provider/openai.ts)

Framing、Endpoint 和 Auth 分别回答了三个问题：事件在哪里结束、请求发到哪里、怎样证明调用者身份。
最后还剩一类变化：**发什么数据，以及怎样理解返回的数据**。这就是 Protocol。

## 修改前的具体问题

`chatWithTools` 同时知道 OpenAI Chat Completions 的请求和响应格式：

```ts
// 请求方向
{ model, stream, messages, tools }

// 响应方向
json.choices[0].delta
```

它还知道工具必须转换成 OpenAI function tool，也知道 `tool_calls[index].function.arguments` 会分成
多个片段到达。这些知识都只对某一种 API 协议成立。

因此，只换成 OpenAI Responses 或 Anthropic Messages 时，即使域名、认证方式和 SSE 分帧完全相同，
仍然必须进入 Provider 修改请求构造、响应字段读取和工具参数拼接。

## Protocol 是双向翻译器

Protocol 的边界不是单独的“请求 body 工厂”，而是一组方向相反的翻译：

```text
项目通用 LLMRequest
        │ encodeRequest
        ▼
厂商请求 Body

厂商响应 Frame
        │ decodeFrame + step + finish
        ▼
项目通用 LLMEvent
```

请求方向把项目语言翻译成厂商语言；响应方向把厂商语言翻译回项目语言。只有两个方向放在一起，
Provider 才能真正不认识 `model`、`choices[0].delta` 等协议细节。

## 完整接口

```ts
export interface Protocol<Body, Frame, VendorEvent, State> {
  readonly id: string
  readonly encodeRequest: (request: LLMRequest) => Body
  readonly response: ProtocolResponse<Frame, VendorEvent, State>
}
```

四个泛型不是需要 import 的类型，而是具体 Protocol 创建时填写的类型占位符：

| 泛型 | 在 OpenAI Chat 中的含义 |
|---|---|
| `Body` | 发给服务器的请求对象 |
| `Frame` | Framing 输出的完整 JSON 字符串 |
| `VendorEvent` | 经过 Schema 校验的厂商事件 |
| `State` | 跨 frame 保存的工具调用片段 |

可以类比 Python 的 `Generic[Body, Frame, VendorEvent, State]`：接口先描述这些类型之间的关系，具体实现再
决定每个类型的真实形状。

## 为什么这一课同时讲两个方向

如果只抽请求方向，Provider 仍然认识厂商响应；只抽响应方向，Provider 仍然构造厂商请求。任何一边
缺失，Protocol 都只能隔离一半变化，也很难解释为什么同一个协议实现需要同时保存 Body、Event 和
State 类型。

所以本课按一个完整问题组织，但把不同阅读重点拆成几篇短文：

1. [请求方向](02-protocol-request.md)：`LLMRequest -> Body`；
2. [Event 到底是什么](03-event.md)：区分 chunk、Frame、VendorEvent、LLMEvent 和最终结果；
3. [响应方向](04-protocol-response.md)：`Frame -> LLMEvent` 状态机；
4. [统一 demo](05-protocol-demo.md)：在一次运行中观察完整双向翻译。

## Protocol 不负责什么

- 不拼 URL，那是 Endpoint；
- 不添加认证 header，那是 Auth；
- 不从网络字节中寻找 SSE 空行，那是 Framing；
- 不执行 `fetch`，当前仍由 Provider 编排，下一节 Route 再处理组合问题。

判断代码应该放在哪里时，可以问：如果只更换 API 的 JSON 字段和事件规则，这段代码是否需要变化？
如果答案是需要，它通常属于 Protocol。

## 对照真实 opencode

接口参考 `opencode/packages/llm/src/route/protocol.ts`，OpenAI Chat 实现参考
`opencode/packages/llm/src/protocols/openai-chat.ts`。真实版本的请求参数和 `LLMEvent` 种类更多，
但“请求 lowering + 响应状态机”的双向边界与本课一致。
