# 6.2 Anthropic Messages API：不同的协议

> 本课目标：理解 OpenAI 和 Anthropic 的 API 格式差异，写 Anthropic Provider 代码（不跑，纯学设计），对照 opencode 的 Protocol 层。
>
> **注意**：我们没有 Anthropic API key，这节课的代码不运行，纯讲设计。像看 opencode 源码一样学习。

## 为什么学 Anthropic

我们的 OpenAI Provider 已经能跑。但只有一种 provider，感受不到"抽象"的价值。

看 Anthropic 的 API 格式——和 OpenAI **完全不同**。如果当初没有 Provider 接口，接 Anthropic 要改 llm.ts 里每一行。有了接口，只需要新写一个 Provider 实现，agent 代码（index.ts）一行不改。

这就是抽象的意义：**加新 provider 不改旧代码**。

## 差异总览

| | OpenAI Chat Completions | Anthropic Messages API |
|---|---|---|
| 端点 | `/chat/completions` | `/messages` |
| 认证 | `Authorization: Bearer <key>` | `x-api-key: <key>` + `anthropic-version: 2023-06-01` |
| system prompt | 在 messages 数组里（`role: "system"`） | 顶层 `system` 字段 |
| 消息内容 | 通常是字符串 | 始终是 content block 数组 |
| 工具定义 | `{type:"function", function:{name, description, parameters}}` | `{name, description, input_schema}` |
| 工具调用 | assistant 消息的 `tool_calls` 数组，arguments 是 JSON 字符串 | assistant 消息的 `tool_use` content block，input 是 JSON 对象 |
| 工具结果 | `role:"tool"` 消息 + `tool_call_id` | `tool_result` content block，放在 `role:"user"` 消息里 |
| max_tokens | 可选 | **必填** |
| 流式格式 | `choices[0].delta` | 事件类型（message_start、content_block_delta 等） |

下面逐个讲关键差异。

## 1. system prompt 的位置

**OpenAI**：system 是 messages 数组的第一条

```json
{
  "messages": [
    { "role": "system", "content": "你是一个助手" },
    { "role": "user", "content": "你好" }
  ]
}
```

**Anthropic**：system 是顶层字段，不在 messages 里

```json
{
  "system": "你是一个助手",
  "messages": [
    { "role": "user", "content": "你好" }
  ]
}
```

> opencode 在 Protocol 层处理这个差异：它的内部模型用统一的 `LLMRequest`（system 在里面），每个 protocol 的 `from` 函数把 `LLMRequest` 转成各自格式——OpenAI 的 `from` 把 system 放进 messages，Anthropic 的 `from` 把 system 提出来放顶层。

## 2. 消息内容：字符串 vs content block 数组

**OpenAI**：content 通常是字符串

```json
{ "role": "user", "content": "你好" }
```

**Anthropic**：content 始终是 block 数组

```json
{ "role": "user", "content": [{ "type": "text", "text": "你好" }] }
```

Anthropic 的 block 类型有：`text`、`image`、`tool_use`、`tool_result`、`thinking`（推理过程）。

## 3. 工具定义

**OpenAI**：包在 `function` 里，参数叫 `parameters`

```json
{
  "type": "function",
  "function": {
    "name": "read",
    "description": "读取文件",
    "parameters": { "type": "object", "properties": { ... } }
  }
}
```

**Anthropic**：扁平结构，参数叫 `input_schema`

```json
{
  "name": "read",
  "description": "读取文件",
  "input_schema": { "type": "object", "properties": { ... } }
}
```

## 4. 工具调用（模型 → 我们）

这是最大的差异。

**OpenAI**：工具调用在 assistant 消息的 `tool_calls` 数组里，`arguments` 是 **JSON 字符串**

```json
{
  "role": "assistant",
  "content": null,
  "tool_calls": [{
    "id": "call_abc",
    "type": "function",
    "function": {
      "name": "read",
      "arguments": "{\"filePath\":\"src/index.ts\"}"
    }
  }]
}
```

**Anthropic**：工具调用是 assistant 消息 content 里的 `tool_use` block，`input` 是 **JSON 对象**

```json
{
  "role": "assistant",
  "content": [
    {
      "type": "tool_use",
      "id": "toolu_abc",
      "name": "read",
      "input": { "filePath": "src/index.ts" }
    }
  ]
}
```

关键区别：
1. OpenAI 的 `arguments` 是字符串（要 `JSON.parse`），Anthropic 的 `input` 是对象（直接用）
2. OpenAI 的 tool_calls 和 content 是平行的两个字段，Anthropic 的 tool_use 是 content 数组里的一个 block

## 5. 工具结果（我们 → 模型）

**OpenAI**：单独的 `role: "tool"` 消息

```json
{
  "role": "tool",
  "tool_call_id": "call_abc",
  "content": "文件内容..."
}
```

**Anthropic**：`tool_result` block，放在 `role: "user"` 消息的 content 里

```json
{
  "role": "user",
  "content": [
    {
      "type": "tool_result",
      "tool_use_id": "toolu_abc",
      "content": "文件内容..."
    }
  ]
}
```

> Anthropic 把工具结果放在 user 消息里——因为从模型视角，"用户"提供了工具的执行结果。

## 6. 流式格式

**OpenAI**：每个 SSE data 是 `choices[0].delta`

```
data: {"choices":[{"delta":{"content":"你"}}]}
data: {"choices":[{"delta":{"content":"好"}}]}
data: [DONE]
```

**Anthropic**：有事件类型，不同阶段发不同事件

```
data: {"type":"message_start","message":{"..."}}
data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"你"}}
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"好"}}
data: {"type":"content_block_stop","index":0}
data: {"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"toolu_abc","name":"read","input":{}}}
data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"{\"file"}}
data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"Path\":\"src/index.ts\"}"}}
data: {"type":"content_block_stop","index":1}
data: {"type":"message_delta","delta":{"stop_reason":"tool_use"}}
data: {"type":"message_stop"}
```

Anthropic 流式复杂得多：
- `content_block_start`：开始一个新 block（文本或工具调用）
- `content_block_delta`：block 内容增量（文本片段或工具参数片段）
- `content_block_stop`：block 结束
- `message_delta`：消息级更新（stop_reason）
- `message_stop`：消息结束

> 对照 opencode：它的 Protocol 层有 `stream.step` 状态机，把不同格式的事件统一转成 `LLMEvent`。agent 代码只看 `LLMEvent`，不关心是 OpenAI 还是 Anthropic 的原始格式。

## 7. 认证

**OpenAI**：Bearer token

```
Authorization: Bearer sk-xxx
```

**Anthropic**：API key header + 版本 header

```
x-api-key: sk-ant-xxx
anthropic-version: 2023-06-01
```

> 对照 opencode 的 Auth 轴：`Auth.bearer(key)` vs `Auth.header("x-api-key")(key)`。同一个 Auth 接口，不同组合方式。

## 本课小结

1. **system prompt**：OpenAI 在 messages 里，Anthropic 是顶层字段
2. **消息内容**：OpenAI 用字符串，Anthropic 用 content block 数组
3. **工具调用**：OpenAI 用 `tool_calls` 数组 + JSON 字符串参数，Anthropic 用 `tool_use` block + JSON 对象参数
4. **工具结果**：OpenAI 用 `role:"tool"` 消息，Anthropic 用 `tool_result` block 放在 user 消息里
5. **流式**：OpenAI 简单的 `delta`，Anthropic 有事件类型分阶段
6. **认证**：Bearer token vs x-api-key header

这些差异就是 opencode Protocol 层要隔离的东西。我们的 Provider 接口是最简化的版本——把所有差异藏在 `chatWithTools` 实现里。

下一步：[6.2 Anthropic Provider 代码](./02-anthropic-provider.md) —— 看具体怎么实现。
