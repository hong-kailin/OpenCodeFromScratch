# 3.1 Tool Calling 是什么：LLM 怎么调用工具

> 本课目标：理解 tool calling 的概念和 OpenAI API 的格式，用 curl 手动调一次带 tools 的请求，看 LLM 怎么返回工具调用。

## LLM 的局限

目前为止我们的 agent 只能聊天——你问它问题，它回答。但它不能：

- 读你电脑上的文件
- 执行命令
- 搜索代码
- 访问网络

LLM 本质上只是一个文本生成器——输入文本，输出文本。它没有手，不能操作你的电脑。

**但 LLM 可以"告诉你"该做什么。** 比如你问"src/index.ts 里写了什么"，LLM 自己读不了文件，但它可以说："请帮我读一下 src/index.ts 这个文件"——然后你执行读取操作，把内容告诉它，它就能回答你了。

这就是 **Tool Calling**（工具调用）——让 LLM 决定调用什么工具，你来执行，结果喂回给它。

## 一个完整的工具调用流程

```
用户：src/index.ts 里写了什么？
    │
    ▼
LLM 收到问题，发现自己需要读文件
    │
    ▼
LLM 返回 tool_call：调用 read 工具，参数 { filePath: "src/index.ts" }
    │
    ▼
你的程序：执行 read 工具，读文件内容
    │
    ▼
把文件内容以 role: "tool" 消息喂回 LLM
    │
    ▼
LLM 看到文件内容，生成回复："这个文件写了入口逻辑，用 readline 循环..."
    │
    ▼
用户看到回复
```

关键：**LLM 不执行工具，它只决定调用什么工具、传什么参数。执行是你的程序做的事。**

## OpenAI API 的 tool calling 格式

### 请求：加 tools 字段

在请求 body 里加 `tools` 数组，告诉 LLM 有哪些工具可用：

```json
{
  "model": "deepseek-v4-flash",
  "messages": [
    {"role": "user", "content": "src/index.ts 里写了什么？"}
  ],
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "read",
        "description": "读取本地文件内容",
        "parameters": {
          "type": "object",
          "properties": {
            "filePath": {
              "type": "string",
              "description": "文件路径"
            }
          },
          "required": ["filePath"]
        }
      }
    }
  ]
}
```

`tools` 数组里每个工具的 structure：

```
{
  "type": "function",       ← 固定值，表示这是一个函数工具
  "function": {
    "name": "read",         ← 工具名（LLM 用这个名字调用）
    "description": "...",   ← 工具说明（LLM 根据这个决定要不要用）
    "parameters": {         ← 参数的 JSON Schema（告诉 LLM 参数格式）
      "type": "object",
      "properties": { ... },
      "required": [...]
    }
  }
}
```

> `parameters` 用的是 **JSON Schema** 格式——一种描述 JSON 结构的标准。`type: "object"` 表示参数是个对象，`properties` 描述每个字段，`required` 列出必填字段。

### 响应：tool_calls

LLM 如果决定调用工具，响应里会有 `tool_calls`：

```json
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": null,
        "tool_calls": [
          {
            "id": "call_abc123",
            "type": "function",
            "function": {
              "name": "read",
              "arguments": "{\"filePath\": \"src/index.ts\"}"
            }
          }
        ]
      },
      "finish_reason": "tool_calls"
    }
  ]
}
```

关键字段：

| 字段 | 含义 |
|------|------|
| `tool_calls` | LLM 要调用的工具列表（可能同时调多个） |
| `tool_calls[0].id` | 这次调用的唯一 ID（喂回结果时要带上） |
| `tool_calls[0].function.name` | 要调用的工具名 |
| `tool_calls[0].function.arguments` | 参数，是 **JSON 字符串**（不是对象，要 JSON.parse） |
| `finish_reason` | `"tool_calls"` 表示 LLM 要调用工具（不是 `"stop"`） |

> 注意：`arguments` 是字符串（`"{\"filePath\": \"src/index.ts\"}"`），不是对象。要 `JSON.parse` 才能用。这是 OpenAI API 的设计，有点反直觉。

### 喂回结果：role 为 tool 的消息

你执行完工具后，把结果以 `role: "tool"` 消息加入 messages，再次请求 LLM：

```json
{
  "model": "deepseek-v4-flash",
  "messages": [
    {"role": "user", "content": "src/index.ts 里写了什么？"},
    {"role": "assistant", "tool_calls": [
      {"id": "call_abc123", "type": "function", "function": {"name": "read", "arguments": "{\"filePath\": \"src/index.ts\"}"}}
    ]},
    {"role": "tool", "tool_call_id": "call_abc123", "content": "1: import { loadConfig, chatStream } from \"./llm\"\n2: ..."}
  ],
  "tools": [ ... ]
}
```

关键：

1. **assistant 消息**：把 LLM 之前的 tool_calls 原样放回 messages（LLM 需要知道自己之前调了什么）
2. **tool 消息**：`role: "tool"`，`tool_call_id` 对应上面的 `id`，`content` 是工具执行结果
3. **再次请求**：带上完整的 messages（包括工具结果），LLM 会根据结果生成最终回复

### finish_reason：怎么知道该继续还是结束

| finish_reason | 含义 | 你的程序该做什么 |
|---------------|------|-----------------|
| `"tool_calls"` | LLM 要调用工具 | 执行工具，喂回结果，继续循环 |
| `"stop"` | LLM 说完了 | 结束循环，打印回复 |

**这就是 tool loop 的核心**：`finish_reason == "tool_calls"` → 执行 → 喂回 → 再请求 → 检查 `finish_reason` → 循环直到 `"stop"`。

## 用 curl 手动调一次

```bash
curl https://ark.cn-beijing.volces.com/api/coding/v3/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ark-你的apiKey" \
  -d '{
    "model": "deepseek-v4-flash",
    "messages": [
      {"role": "user", "content": "请读取 src/index.ts 这个文件"}
    ],
    "tools": [
      {
        "type": "function",
        "function": {
          "name": "read",
          "description": "读取本地文件内容，返回带行号的文本",
          "parameters": {
            "type": "object",
            "properties": {
              "filePath": {
                "type": "string",
                "description": "要读取的文件路径"
              }
            },
            "required": ["filePath"]
          }
        }
      }
    ]
  }'
```

你会看到 LLM 返回 `tool_calls`：

```json
{
  "choices": [{
    "message": {
      "role": "assistant",
      "content": null,
      "tool_calls": [{
        "id": "call_xxx",
        "type": "function",
        "function": {
          "name": "read",
          "arguments": "{\"filePath\":\"src/index.ts\"}"
        }
      }]
    },
    "finish_reason": "tool_calls"
  }]
}
```

LLM 决定调用 `read` 工具，参数是 `{"filePath": "src/index.ts"}`。**它没有真的读文件——它只是告诉你"我要读这个文件"。**

## 对照 opencode

opencode 的 Tool 接口定义在 `opencode/packages/opencode/src/tool/tool.ts:55`：

```ts
export interface Def<Parameters, M> {
  id: string                    // 工具名（对应 API 的 function.name）
  description: string           // 工具说明（对应 API 的 function.description）
  parameters: Parameters        // 参数 schema（对应 API 的 function.parameters）
  jsonSchema?: JSONSchema7      // 直接指定 JSON Schema（可选）
  execute(args, ctx): Effect    // 执行函数
}
```

和 OpenAI API 的对应关系：

| OpenAI API 字段 | opencode 的 Def 字段 | 我们的（3.2 课会定义） |
|-----------------|---------------------|----------------------|
| `function.name` | `id` | `id` |
| `function.description` | `description` | `description` |
| `function.parameters` | `parameters` / `jsonSchema` | `parameters` |
| — | `execute(args, ctx)` | `execute(args)` |

opencode 的 read 工具描述在 `opencode/packages/opencode/src/tool/read.txt`——纯文本，不是 JSON。opencode 把它 import 进来作为 `description`：

```ts
import DESCRIPTION from "./read.txt"  // Bun 支持把 .txt 当字符串导入
```

> opencode 的 Tool 接口比我们的复杂得多——有 Effect、Schema、Context（含 sessionID/abort/权限等）。我们 3.2 课会定义简化版，后续阶段逐步补全。

## 本课小结

1. **Tool Calling**：LLM 不执行工具，只决定调用什么工具、传什么参数，你的程序执行后把结果喂回
2. **请求加 tools**：告诉 LLM 有哪些工具可用（name + description + parameters JSON Schema）
3. **响应返回 tool_calls**：LLM 决定调用工具时，`finish_reason` 是 `"tool_calls"`，`tool_calls` 里有 name 和 arguments
4. **arguments 是字符串**：`JSON.parse` 后才能用
5. **喂回结果**：以 `role: "tool"` 消息加入 messages，`tool_call_id` 对应调用的 id
6. **finish_reason 判断循环**：`"tool_calls"` → 继续，`"stop"` → 结束

下一步：[3.2 定义 Tool 接口 + 实现 read 工具](../02-tool-interface/01-tool-interface.md) —— 用 TS 代码定义工具、实现 read。
