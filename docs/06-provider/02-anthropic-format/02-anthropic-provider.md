# 6.2 Anthropic Provider 代码

> 本课目标：写 Anthropic Provider 实现（不跑），理解消息格式转换的细节，对照 opencode 的 Protocol 层。
>
> **注意**：没有 Anthropic API key，这段代码不运行。像看 opencode 源码一样学习。

## 设计思路

我们的 Provider 接口接收 `Message[]`（OpenAI 格式），返回 `ChatResult`（OpenAI 格式）。Anthropic Provider 要做两件事：

1. **请求前**：把 OpenAI 格式的 messages 转成 Anthropic 格式
2. **响应后**：把 Anthropic 格式的流式响应转回 OpenAI 格式的 `ChatResult`

```
我们的 Message[]（OpenAI 格式）
    │
    ▼ convertMessages()
Anthropic 请求体（system 提出来 + content block 数组 + 工具格式转换）
    │
    ▼ fetch Anthropic API
Anthropic 流式响应（事件类型）
    │
    ▼ 解析 + 转换
ChatResult（OpenAI 格式：text + toolCalls）
```

> 对照 opencode：它的 Protocol 层做同样的事——`body.from` 把统一的 `LLMRequest` 转成 provider 格式，`stream.step` 把 provider 响应转成统一的 `LLMEvent`。我们的转换函数就是简化版的 Protocol。

## 关键转换

### 1. system prompt 提取

OpenAI 的 system 在 messages[0]，Anthropic 要放顶层：

```ts
// 从 messages 里提取 system prompt
const systemMsg = messages.find(m => m.role === "system")
const system = systemMsg?.content || ""
// 剩下的消息去掉 system
const chatMessages = messages.filter(m => m.role !== "system")
```

### 2. assistant 消息的 tool_calls → tool_use block

OpenAI 格式：
```json
{ "role": "assistant", "content": null, "tool_calls": [{ "id": "call_1", "function": { "name": "read", "arguments": "{\"filePath\":\"a.ts\"}" } }] }
```

转成 Anthropic 格式：
```json
{ "role": "assistant", "content": [{ "type": "tool_use", "id": "call_1", "name": "read", "input": { "filePath": "a.ts" } }] }
```

关键：`arguments` 是 JSON 字符串，要 `JSON.parse` 成对象变成 `input`。

### 3. tool 消息 → user 消息里的 tool_result block

OpenAI 格式：
```json
{ "role": "tool", "tool_call_id": "call_1", "content": "文件内容" }
```

转成 Anthropic 格式：
```json
{ "role": "user", "content": [{ "type": "tool_result", "tool_use_id": "call_1", "content": "文件内容" }] }
```

关键：`role: "tool"` 变成 `role: "user"`，`tool_call_id` 变成 `tool_use_id`。

### 4. 流式解析

Anthropic 的流式有事件类型。我们只关心两种 delta：
- `text_delta`：文本增量（对应 OpenAI 的 `delta.content`）
- `input_json_delta`：工具参数增量（对应 OpenAI 的 `delta.tool_calls[].function.arguments`）

按 `index` 累积工具调用，和 OpenAI Provider 的逻辑一样。

## 代码

代码在 `src/provider/anthropic.ts`。这是参考实现，不运行。重点看：
1. `convertMessages`：OpenAI messages → Anthropic messages + system
2. `convertTools`：OpenAI tool 格式 → Anthropic tool 格式
3. 流式解析：按事件类型提取文本和工具调用
4. 认证：`x-api-key` + `anthropic-version` header

## 对照 opencode Protocol 层

| | 我们的 Anthropic Provider | opencode 的 Protocol |
|---|---|---|
| 请求转换 | `convertMessages` 函数 | `ProtocolBody.from`（LLMRequest → Anthropic body） |
| 响应解析 | 流式里按事件类型处理 | `ProtocolStream.step`（状态机） |
| 工具格式 | 手动转换 | `lowerTool` 函数 |
| 消息格式 | 手动转换 | `lowerMessage` 函数 |
| 统一接口 | `Provider.chatWithTools` | `Route.streamPrepared` → `LLMEvent` |

opencode 的 Protocol 更完善：
- 有 Schema 校验（请求体和响应事件都有 Schema，不合法会报错）
- 有状态机（`step` 函数维护解析状态，处理边界情况）
- 有 `terminal` 判断（提前知道流什么时候结束）
- 工具参数有 `partial_json` 累积（和我们的 `arguments` 拼接类似）

我们的简化版没有这些，但核心逻辑一样：**把 provider 特有的格式转成统一的内部格式**。

## 本课小结

1. **Anthropic Provider 的核心是格式转换**：OpenAI messages → Anthropic 请求体，Anthropic 响应 → ChatResult
2. **system 提取**：从 messages[0] 拿出来放顶层
3. **tool_calls → tool_use**：arguments 字符串 parse 成 input 对象
4. **tool → user + tool_result**：role 变了，tool_call_id 变 tool_use_id
5. **流式解析**：按事件类型（text_delta、input_json_delta）提取内容
6. **opencode 的 Protocol 层**做同样的事，但有 Schema 校验和状态机，更健壮

下一步：[6.3 对照 opencode Route 四轴模型 + 阶段验收](../03-route-model/) —— 正交组合的设计思想。
