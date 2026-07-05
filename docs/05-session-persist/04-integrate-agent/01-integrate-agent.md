# 5.4 集成到 Agent：重启恢复对话

> 本课目标：把 session 和 message 持久化集成到 `src/index.ts`，实现启动时选择新建/恢复会话，对话中自动保存。

## 改造了什么

之前的 `src/index.ts`：
- messages 在内存里，重启就没了
- 每次启动都是全新对话

改造后：
- 启动时列出已有 session，可以选择恢复
- 每条消息（user、assistant、tool）自动存入数据库
- 重启后从数据库加载历史，继续对话

## 启动流程：新建 vs 恢复

```
启动
  │
  ▼
列出所有 session（listSessions）
  │
  ├── 有历史 session？
  │     │
  │     ├── 是 → 显示列表，用户选择
  │     │     ├── 选 "新建" → createSession() → messages = [systemPrompt]
  │     │     └── 选某个 → loadMessages(id) → messages = [systemPrompt, ...历史]
  │     │
  │     └── 否 → 直接 createSession() → messages = [systemPrompt]
  │
  ▼
进入对话循环
```

关键设计：**system prompt 不存数据库**。每次启动重新生成，拼在 messages 数组最前面。原因：
1. system prompt 可能会变（比如工具列表改了）
2. 它不是对话历史的一部分，是给 LLM 的指令
3. 数据库里只存 user/assistant/tool 消息——真正的对话内容

> 对照 opencode：它的 system prompt 由 `system-context` 模块组装，也不存数据库。阶段 7 会实现这个模块。

## 对话中自动保存

每次往 messages 数组 push 一条消息，同时调用 `saveMessage` 存入数据库：

```ts
// 用户消息
const userMsg: Message = { role: "user", content: input }
messages.push(userMsg)                    // 内存
await saveMessage(sessionId, userMsg)     // 数据库

// assistant 消息（带 tool_calls）
const assistantMsg: Message = { role: "assistant", content: result.text, tool_calls: result.toolCalls }
messages.push(assistantMsg)
await saveMessage(sessionId, assistantMsg)

// tool 结果
const toolMsg: Message = { role: "tool", tool_call_id: tc.id, content: truncate(output) }
messages.push(toolMsg)
await saveMessage(sessionId, toolMsg)
```

每条消息存两份：内存一份（给 LLM 用），数据库一份（持久化）。内存是权威源，数据库是持久化副本。

> **为什么不从数据库读？** 每轮对话都从数据库查 messages 太慢。内存里维护 messages 数组，LLM 直接用。数据库只负责持久化——重启时才读。

## 运行

```bash
bun run src/index.ts
```

第一次运行：没有历史 session，直接新建。
```
AI 助手已启动 → 新建会话: New session - 2026/7/5 19:30:00

输入问题开始对话（Ctrl+C 退出）

你: 你好
AI: 你好！有什么可以帮你的？
```

第二次运行：有历史 session，可以选择恢复。
```
AI 助手已启动

已有会话：
  [0] New session - 2026/7/5 19:30:00  (2026/7/5 19:30:05)
  [1] 新建会话

请选择: 0

已恢复会话: New session - 2026/7/5 19:30:00 (2 条历史消息)

输入问题开始对话（Ctrl+C 退出）

你: 我刚才说了什么？
AI: 你说了"你好"。
```

## 调试模式

VSCode Debug Console 不支持 stdin。`DEBUG_INPUTS` 环境变量预设输入：

```json
// .vscode/launch.json
{
  "env": {
    "DEBUG_INPUTS": "[\"你好\"]"
  }
}
```

调试模式下自动新建 session（跳过交互选择），DEBUG_INPUTS 里的字符串依次作为用户输入。

> 复习 0.6 课：`DEBUG_INPUTS` 是我们解决 VSCode Debug Console 不支持 stdin 的方案。

## 对照 opencode

| | 我们的实现 | opencode |
|---|-----------|----------|
| session 层级 | 扁平，所有 session 平级 | 多层：project → workspace → session → parent/child |
| 恢复方式 | 列出全部，用户选 | TUI 里按 project/directory 过滤 |
| 消息保存 | 每条消息直接 INSERT | 事件溯源：publish 事件 → projector 异步写库 |
| system prompt | 硬编码字符串 | system-context 模块组装（AGENTS.md + 日期 + 环境 + 工具列表） |
| 持久化时机 | 每条消息 push 后立即存 | 事件发布后异步存（可能丢最后几条如果崩溃） |

### opencode 的事件溯源

opencode 不直接写数据库。它发布事件（如 `MessageUpdated`），一个叫 projector 的组件订阅事件并写库。这带来几个特性：

1. **解耦**：业务逻辑只管发事件，不关心怎么存
2. **可重放**：从事件日志可以重建数据库状态
3. **多视图**：同一份事件可以投影到不同的读模型

代价是复杂度高。我们用直接 CRUD，简单直接，后续阶段再考虑是否引入事件溯源。

## 本课小结

1. **启动选择**：列出 session → 用户选 → 新建或恢复
2. **system prompt 不存数据库**：每次启动重新生成，拼在 messages 最前面
3. **自动保存**：每条消息 push 到内存的同时 saveMessage 到数据库
4. **内存是权威源**：对话中用内存的 messages 数组，数据库只负责持久化
5. **调试模式**：DEBUG_INPUTS 模式下自动新建 session，跳过交互选择

下一步：5.5 课——阶段验收，总结工程思维。
