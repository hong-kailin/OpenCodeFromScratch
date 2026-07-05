# 3.4 阶段验收：能读文件的 agent + 工程思维总结

> 本课目标：验收阶段 3 的成果，总结工程思维，对照 opencode 看差距。

## 验收清单

```bash
# 1. 类型检查通过
bun run typecheck

# 2. tool loop 能跑
bun run src/index.ts
# 输入 "src/index.ts 里写了什么？" → AI 调 read 工具 → 回答内容

# 3. 调试模式
# VSCode 选 "调试（预设输入）" → F5 → 断点能触发
```

| 验收项 | 状态 |
|--------|------|
| Tool Calling 概念（tools/tool_calls/tool role） | ✓ |
| Tool 接口定义（id/description/parameters/execute） | ✓ |
| read 工具实现（读文件 + 加行号） | ✓ |
| toolToOpenAIFormat 转换 | ✓ |
| 流式 tool_calls 累积（Map by index） | ✓ |
| tool loop（检测 → 执行 → 喂回 → 循环） | ✓ |
| max_steps 防止无限循环 | ✓ |
| 多轮对话 + 工具调用 | ✓ |

## 项目结构

阶段 3 新增的代码：

```
src/
├── index.ts          # 修改：加入 tool loop（while 循环 + 执行工具）
├── llm.ts            # 修改：新增 chatWithTools()（流式 + 工具调用检测）
├── types.ts          # 修改：新增 ToolCall、扩展 Message（tool_calls/tool role）
└── tool/
    ├── tool.ts       # 新增：Tool 接口 + JSONSchema + toolToOpenAIFormat
    ├── read.ts       # 新增：read 工具实现
    └── read.txt      # 新增：工具描述（LLM 看的说明）
```

## 对照 opencode：我们的 vs 真实版

我们的 tool loop：

```ts
// 简化版：while 循环 + fetch + 手动累积
while (step < MAX_STEPS) {
  const result = await chatWithTools(messages, config, tools, onChunk)
  if (result.toolCalls.length === 0) break
  // 执行工具，喂回结果
  for (const tc of result.toolCalls) {
    const output = await tool.execute(args)
    messages.push({ role: "tool", tool_call_id: tc.id, content: output })
  }
}
```

opencode 的 runLoop（`session/prompt.ts:1081`）：

```ts
// 真实版：Effect + 持久化 + 流式事件 + 权限
const runLoop = (sessionID) => Effect.fn("SessionPrompt.run")(function* (sessionID) {
  while (true) {
    let msgs = yield* MessageV2.filterCompactedEffect(sessionID)
    const result = yield* handle.process({ messages: msgs, tools, ... })
    if (lastFinished && !hasToolCalls) break
    // 工具结果持久化到数据库
    // 权限检查
    // 事件系统通知 UI
  }
})
```

差距和原因：

| | 我们的 | opencode 的 | 为什么 opencode 更复杂 |
|---|--------|-------------|----------------------|
| 工具定义 | JSON Schema + async execute | Effect Schema + Effect execute | 运行时参数校验、typed error |
| 工具执行 | `tool.execute(args)` | `ToolRuntime.dispatch(tools, call)` | 权限检查、输出截断、事件通知 |
| 结果喂回 | `messages.push({ role: "tool" })` | 持久化到数据库 + 投影 | 跨重启恢复、UI 实时更新 |
| 退出判断 | `toolCalls.length === 0` | `finish_reason` + `hasToolCalls` + orphaned 检测 | 更健壮的边界处理 |
| 工具上下文 | 无 | `Context`（sessionID/abort/permission/messages） | 权限、取消、会话隔离 |
| 输出截断 | 无 | `Truncate.output()` 50KB 上限 | 防止撑爆 LLM 上下文 |

**后续阶段会逐步补全**：阶段 4 加更多工具，阶段 5 加持久化，阶段 10 加权限。

## 工程思维总结

### 1. Tool loop 是 agent 的本质

阶段 1-2 的 agent 只能聊天——你问它答。阶段 3 加了 tool loop 后，agent 有了"手脚"：

- **LLM 是大脑**：决定该做什么（调用什么工具、传什么参数）
- **工具是手脚**：执行实际操作（读文件、执行命令、搜索代码）
- **loop 是循环**：做完一步看结果，决定下一步做什么，直到完成

这就是 agent 和聊天机器人的本质区别——**agent 能行动，聊天机器人只能说话**。

> opencode 的整个 `session/prompt.ts` 就是在实现这个 loop，只是更健壮、更复杂。

### 2. 声明式工具定义

我们的 Tool 接口是**声明式**的——你声明工具的名字、描述、参数格式、执行函数，LLM 根据这些信息自己决定调用什么。你不需要写 `if (用户问文件) { 调 read }` 这样的硬编码逻辑。

```ts
// 声明式：你只定义工具，LLM 自己决定什么时候用
const tools = [readTool]
const result = await chatWithTools(messages, config, tools, ...)

// 对比命令式：不用工具的话，你得自己判断
if (用户问文件内容) {
  const content = readFileSync(用户提到的文件)
  // 手动把内容塞给 LLM
}
```

声明式的好处：**加一个新工具只需要定义 Tool 对象，不用改任何其他代码**。LLM 会自动根据描述决定用不用它。阶段 4 我们会加 write、bash 等工具，只需要定义 Tool 对象，tool loop 不用改。

### 3. 流式 + 工具调用的复杂度

阶段 2 的流式只处理 `delta.content`（文本）。阶段 3 加了 `delta.tool_calls`——参数分块到达，要按 index 累积拼接。这是流式编程的典型复杂度：**数据不是一次性到达的，你要处理"碎片"**。

> opencode 用 Effect Stream 的 `mapAccumEffect`（状态机）处理这个问题——每个 delta 是一次状态转换，自动累积。我们用 Map 手动累积，更直观但更容易出错（比如跨 chunk 边界）。

## 阶段 3 学了什么

| 课 | 知识点 |
|----|--------|
| 3.1 | Tool Calling 概念、OpenAI API 格式（tools/tool_calls/tool role）、finish_reason 判断循环 |
| 3.2 | Tool 接口定义、JSON Schema、toolToOpenAIFormat、read 工具实现、.txt 导入 |
| 3.3 | 流式 tool_calls 累积（Map by index）、tool loop（while + 执行 + 喂回）、max_steps |

你现在是"能用工具的 agent"状态。AI 能自动读文件、根据内容回答。下一步要加更多工具——让它能写文件、执行命令、搜索代码。

---

下一步：[阶段 4：工具集](../../04-tools/) —— 实现 write、edit、bash 等更多工具。
