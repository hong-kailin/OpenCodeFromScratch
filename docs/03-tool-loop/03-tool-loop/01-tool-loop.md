# 3.3 实现 tool loop：检测、执行、喂回、循环

> 本课目标：把 read 工具接入 LLM，实现完整的 tool loop——LLM 返回工具调用时执行工具、把结果喂回、继续循环，直到 LLM 不再调用工具。

## tool loop 是什么

3.1 课讲了 tool calling 的流程，3.2 课实现了 read 工具。现在要把它们串起来——这就是 tool loop：

```
用户：src/index.ts 里写了什么？
    │
    ▼
┌─→ 调 LLM（带 tools）
│     │
│     ▼
│   LLM 返回 tool_calls（finish_reason: "tool_calls"）
│     │
│     ▼
│   执行工具：read({ filePath: "src/index.ts" })
│     │
│     ▼
│   把结果以 role: "tool" 加入 messages
│     │
└── 继续（回到调 LLM）
    │
    ▼
  LLM 返回文本（finish_reason: "stop"）→ 打印回复 → 结束
```

核心判断：**finish_reason 是 `"tool_calls"` 就继续循环，是 `"stop"` 就结束。**

## 流式响应里的 tool_calls

阶段 2 我们学了流式文本（`delta.content` 逐块到达）。tool_calls 也是流式的——参数被拆成多块：

```
data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_abc","type":"function","function":{"name":"read","arguments":""}}]}}]}

data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\"file"}}]}}]}

data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"Path\": \"src/index.ts\"}"}}]}}]}

data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}
```

- 第一个 delta：有 `id`、`name`，`arguments` 是空字符串
- 后续 delta：只有 `arguments` 的片段，要拼接
- 最后：`finish_reason: "tool_calls"`

### 怎么累积 tool_calls

用 `Map` 按 `index` 累积（LLM 可能同时调多个工具，用 index 区分）：

```ts
// toolCallsMap：按 index 累积每个工具调用
const toolCallsMap = new Map<number, { id: string; name: string; arguments: string }>()

// 流式处理时：
const delta = json.choices[0]?.delta
if (delta?.tool_calls) {
  for (const tc of delta.tool_calls) {
    const existing = toolCallsMap.get(tc.index)
    if (existing) {
      // 已有：拼接 arguments 片段
      if (tc.function?.arguments) existing.arguments += tc.function.arguments
    } else {
      // 新的：记录 id 和 name
      toolCallsMap.set(tc.index, {
        id: tc.id,
        name: tc.function?.name || "",
        arguments: tc.function?.arguments || "",
      })
    }
  }
}
```

> 类比：拼图。第一个 delta 给你拼图框（id + name），后续 delta 给你碎片（arguments 片段），你把它们粘在一起。

## 执行工具

流结束后，检查 `toolCallsMap` 是否有工具调用。有就执行：

```ts
// 遍历所有工具调用
for (const [, tc] of toolCallsMap) {
  // 根据 name 找到对应的工具
  const tool = tools.find((t) => t.id === tc.name)
  if (!tool) {
    // 工具不存在，把错误信息喂回 LLM
    messages.push({
      role: "tool",
      tool_call_id: tc.id,
      content: `错误：找不到工具 ${tc.name}`,
    })
    continue
  }

  // 解析参数（arguments 是 JSON 字符串，要 parse）
  const args = JSON.parse(tc.arguments)

  // 执行工具
  console.log(`  [调用工具] ${tc.name}(${tc.arguments})`)
  const result = await tool.execute(args)

  // 把结果以 role: "tool" 加入 messages
  messages.push({
    role: "tool",
    tool_call_id: tc.id,
    content: result,
  })
}
```

关键步骤：
1. **根据 name 找工具**：`tools.find(t => t.id === tc.name)`
2. **JSON.parse 参数**：`arguments` 是字符串，要解析成对象
3. **执行**：调 `tool.execute(args)`
4. **喂回**：以 `role: "tool"` 消息加入 messages，`tool_call_id` 对应调用的 id

## assistant 消息也要加入 messages

执行完工具后，还要把 LLM 返回的 tool_calls 作为 assistant 消息加入 messages（LLM 需要知道自己之前调了什么）：

```ts
// 把 LLM 的 tool_calls 作为 assistant 消息加入 messages
messages.push({
  role: "assistant",
  content: null,        // 有 tool_calls 时 content 通常是 null
  tool_calls: Array.from(toolCallsMap.values()).map(tc => ({
    id: tc.id,
    type: "function",
    function: { name: tc.name, arguments: tc.arguments },
  })),
})
```

## 完整的 tool loop

```ts
const MAX_STEPS = 20  // 防止无限循环

let step = 0
while (step < MAX_STEPS) {
  step++

  // 1. 调 LLM（带 tools）
  const result = await chatWithTools(messages, config, tools, (text) => {
    process.stdout.write(text)  // 流式打印文本
  })

  // 2. 没有 tool_calls → LLM 说完了，结束循环
  if (result.toolCalls.length === 0) {
    messages.push({ role: "assistant", content: result.text })
    break
  }

  // 3. 有 tool_calls → 把 assistant 消息加入 messages
  messages.push({
    role: "assistant",
    content: result.text || null,
    tool_calls: result.toolCalls,
  })

  // 4. 执行每个工具，把结果加入 messages
  for (const tc of result.toolCalls) {
    const tool = tools.find(t => t.id === tc.function.name)
    const args = JSON.parse(tc.function.arguments)
    const output = await tool.execute(args)
    messages.push({
      role: "tool",
      tool_call_id: tc.id,
      content: output,
    })
  }

  // 5. 继续循环（回到调 LLM）
}
```

### max_steps：防止无限循环

LLM 可能一直调工具不停下来（比如工具一直报错，LLM 一直重试）。加 `MAX_STEPS` 限制最大循环次数：

```ts
const MAX_STEPS = 20  // 最多循环 20 次
```

> 对照 opencode：它的 `MAX_STEPS_PROMPT` 定义在 `packages/core/src/session/runner/max-steps.ts`，也是限制最大步数。

## 扩展 Message 类型

tool calling 需要新的消息类型——assistant 消息可能带 `tool_calls`，还有新的 `role: "tool"` 消息。更新 `types.ts`：

```ts
// 工具调用（LLM 返回的）
export interface ToolCall {
  id: string
  type: "function"
  function: {
    name: string
    arguments: string  // JSON 字符串
  }
}

// 消息类型（扩展：支持 tool_calls 和 tool role）
export interface Message {
  role: "system" | "user" | "assistant" | "tool"
  content: string | null       // assistant 带 tool_calls 时 content 可能是 null
  tool_calls?: ToolCall[]      // 只有 assistant 消息有
  tool_call_id?: string        // 只有 tool 消息有（对应 tool_calls 的 id）
}
```

## 跑起来

```bash
bun run src/index.ts
```

交互过程：

```
AI 助手已启动，输入问题开始对话（Ctrl+C 退出）
你: src/index.ts 里写了什么？
  [调用工具] read({"filePath":"src/index.ts"})
AI: 这个文件是程序的入口，主要做了以下几件事：
1. 读取配置
2. 初始化 messages 历史
3. 进入多轮对话循环...
```

AI 自己决定调用 read 工具读文件，然后根据文件内容回答你的问题。

## 对照 opencode

| | 我们的 tool loop | opencode 的 runLoop |
|---|-----------------|---------------------|
| 循环结构 | `while (step < MAX_STEPS)` | `while (true)` + 退出条件判断 |
| 工具执行 | `tool.execute(args)` | `ToolRuntime.dispatch(tools, call)` |
| 结果喂回 | `messages.push({ role: "tool" })` | 持久化到数据库 + 投影到 messages |
| 最大步数 | `MAX_STEPS = 20` | `MAX_STEPS_PROMPT` |
| 流式 | 是（累积 tool_calls from deltas） | 是（Effect Stream + 事件系统） |
| 权限检查 | 无 | `ctx.ask({ permission: "read" })` |

## 本课小结

1. **tool loop**：while 循环——调 LLM → 有 tool_calls 就执行 → 喂回 → 继续循环 → 没有 tool_calls 就结束
2. **流式 tool_calls**：参数被拆成多块，用 Map 按 index 累积拼接
3. **执行工具**：根据 name 找工具 → JSON.parse 参数 → 调 execute → 结果以 role: "tool" 喂回
4. **assistant 消息**：LLM 的 tool_calls 也要加入 messages（它需要知道自己调了什么）
5. **max_steps**：防止无限循环，默认 20 次
6. **Message 扩展**：新增 tool_calls、tool_call_id、role: "tool"

下一步：[3.4 阶段验收](../04-stage-review/01-stage-review.md) —— 验收 + 工程思维总结。
