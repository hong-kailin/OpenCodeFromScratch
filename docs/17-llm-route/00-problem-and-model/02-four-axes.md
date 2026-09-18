# 17.0（下）Route 四轴模型是什么

[上一份文档](./01-current-problem.md) 找到的核心问题是：`Provider` 接口保护了 Agent loop，
但 Provider 内部仍是一个无法局部复用的整体。

opencode 把一次 LLM 调用拆成四种职责：**Protocol、Endpoint、Auth、Framing**。
这四种职责组合后的可执行路线叫做 **Route**。

## 先看完整流水线

```text
通用 LLMRequest
      │
      ▼
Protocol：转成厂商请求体
      │
      ▼
Endpoint：根据请求体确定 URL
      │
      ▼
Auth：给这次请求加入认证信息
      │
      ▼
HTTP 请求 / 字节响应流
      │
      ▼
Framing：把连续字节切成完整帧
      │
      ▼
Protocol：把厂商事件翻译成通用 LLMEvent
```

Protocol 在请求和响应两端各出现一次，因为它负责双方“说什么话”；Framing 只负责从连续字节中
找出事件边界，并不理解事件表达的业务含义。

四个轴的边界可以压缩成一张表：

| 轴 | 主要输入 | 主要输出 | 不负责 |
|---|---|---|---|
| Protocol | 通用请求；完整 frame | 厂商 body；通用事件 | 域名、凭据、字节边界 |
| Endpoint | 已解析请求和厂商 body | URL | header、事件含义 |
| Auth | method、URL、body、headers | 加入认证后的 headers | 请求体转换、流解析 |
| Framing | 连续字节流 | 完整 frame 流 | frame 内 JSON 的业务含义 |

## Protocol：双方说什么格式

Protocol 是语义契约，负责：

- 把通用 messages、tools 和生成参数转换成厂商请求体；
- 校验请求体和流事件的结构；
- 把厂商事件状态机翻译成统一的文本、工具调用、usage 和结束事件。

Chat Completions 的 `messages` 与 `choices[0].delta` 属于 Protocol；Responses 的 `input`
与 `response.output_text.delta` 也属于 Protocol。Protocol 不决定请求发到哪个域名，也不读取 API key。

参考实现：[protocol.ts](../../../opencode/packages/llm/src/route/protocol.ts)。

## Endpoint：请求发到哪里

Endpoint 只负责构造 URL：`baseURL + path + query`。多数路径是固定字符串；少数服务会把模型、
区域或部署名放进路径，所以 Endpoint 也可以根据已构造的请求体计算 URL。

同一套 OpenAI Chat Protocol 可以发往 OpenAI、火山、DeepSeek 或 TogetherAI；变化的是 Endpoint，
消息转换和事件解析无需复制。

参考实现：[endpoint.ts](../../../opencode/packages/llm/src/route/endpoint.ts)。

## Auth：这次请求凭什么被接受

Auth 接收一份即将发送的请求，为它添加或签署认证信息，例如：

- `Authorization: Bearer <api-key>`；
- `x-api-key: <key>`；
- ChatGPT OAuth access token；
- AWS SigV4 这类逐请求签名。

Auth 不决定请求 body 的字段，也不解析返回事件。OAuth 的登录、保存和刷新会提供凭据，Route Auth
只负责把当前可用凭据应用到这次请求；两者有关联，但不是同一层职责。

参考实现：[auth.ts](../../../opencode/packages/llm/src/route/auth.ts)。

## Framing：连续字节在哪里切开

HTTP body 到达时只是 `Uint8Array` 流。Framing 负责把它切成 Protocol 能消费的完整帧：

- SSE：跨 chunk 缓冲，识别空行边界，取出完整 `data:` payload；
- AWS event-stream：按二进制长度字段切帧并校验 CRC。

Framing 不应该读取 `choices[0].delta`，因为那是 Protocol 的语义。OpenAI Chat、Responses 和
Anthropic Messages 都能复用 SSE Framing，即使三者的 JSON 完全不同。

参考实现：[framing.ts](../../../opencode/packages/llm/src/route/framing.ts)。

## Route：四种职责的一次组合

用矩阵看得最清楚：

| Route | Protocol | Endpoint | Auth | Framing |
|---|---|---|---|---|
| 火山 Coding Plan | OpenAI Chat | 火山 `/chat/completions` | Bearer API key | SSE |
| Anthropic | Anthropic Messages | Anthropic `/messages` | `x-api-key` | SSE |
| Codex 订阅 | OpenAI Responses | ChatGPT Codex `/responses` | OAuth token + account | SSE |
| Bedrock Converse | Bedrock Converse | AWS 区域端点 | SigV4 | AWS event-stream |

因此 Provider 和 Route 不是同义词：Provider 表示服务或产品身份；一个 Provider 可以暴露多条
Route，例如 OpenAI 同时有 Chat Completions、Responses 和 Responses WebSocket。

“四轴正交”也不是说它们毫无类型联系，而是说每一轴有独立的变化原因。Endpoint 需要看到请求体，
Protocol 需要接收 Framing 产出的帧，但修改认证策略不应迫使我们复制协议状态机。

## Transport 为什么没有列成第五轴

真实源码中的 Route 还持有 Transport，用来真正发送 HTTP 或 WebSocket。对普通 HTTP 流式接口，
Transport 把 Endpoint、Auth 和 Framing 串起来；四轴仍描述最重要的可替换职责。

阶段 17 先处理当前项目真实存在的 HTTP + SSE 路线。等 Codex 的 HTTP Route 跑通后，再对照源码中
Transport 的位置，不提前把 WebSocket 复杂度搬进来。

## 阶段 17 的验收标准

完成重构后，Codex 不应是一份复制出来的大型 Provider。它应该主要表现为一组选择：

```text
OpenAI Responses Protocol
+ Codex Endpoint
+ OAuth Auth
+ SSE Framing
= Codex Route
```

而火山接入继续选择 OpenAI Chat Protocol、火山 Endpoint、Bearer Auth 和同一份 SSE Framing。
两条路线共享能共享的部分，只保留真正不同的部分。

下一节会从最具体、已经存在 bug 的边界开始：先把 SSE 字节分帧从 OpenAI Provider 中抽出来。
