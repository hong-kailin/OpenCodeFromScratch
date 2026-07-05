# 5.3 Message 模块与 opencode 对比

> 本课目标：实现 `src/message.ts` 的 `saveMessage` 和 `loadMessages`，对照 opencode 的两表设计理解 trade-off。

## 运行演示

```bash
bun run src/message-demo.ts
```

> 教学代码 `src/message-demo.ts` 已清理，可通过 git 历史查看。

演示内容：创建 session → 保存 4 种消息（user、assistant 带 tool_calls、tool 结果、assistant 回复）→ 加载全部消息 → 验证 JSON 序列化/反序列化正确。

## 我们的实现

`src/message.ts` 提供两个函数：

```
saveMessage(sessionId, msg)  → void      保存一条消息
loadMessages(sessionId)      → Message[]  加载一个 session 的所有消息
```

### saveMessage

```ts
export async function saveMessage(sessionId: string, msg: Message): Promise<void> {
  const row = messageToRow(sessionId, msg)  // Message → DB 行（含 JSON 序列化）
  await db.insert(messageTable).values(row)
}
```

就是上一课学的 `INSERT`，加上 JSON 序列化的转换。

### loadMessages

```ts
export async function loadMessages(sessionId: string): Promise<Message[]> {
  const rows = await db.select().from(messageTable)
    .where(eq(messageTable.session_id, sessionId))  // 按 session_id 过滤
    .orderBy(asc(messageTable.time_created))        // 按时间升序（最早在前）
    .all()
  return rows.map(rowToMessage)  // DB 行 → Message（含 JSON 反序列化）
}
```

按 `session_id` 查消息，按 `time_created` 升序排列（最早的在前，这样喂给 LLM 时顺序正确）。

> **为什么要排序？** 对话有严格的顺序。先 user 问，再 assistant 答，再 tool 结果，再 assistant 回复。如果不排序，数据库返回的顺序不确定，对话就乱了。

## 对照 opencode：两表设计

opencode 不像我们把所有消息内容放一个表。它把消息拆成 **message（容器）+ part（内容片段）** 两个表。

### 为什么拆两个表

一条 assistant 消息可能包含：
- 文本内容（"我来帮你读这个文件"）
- 工具调用（调 read 工具）
- 工具执行后的状态变化（pending → running → completed）
- 推理过程（reasoning，有些模型会返回思考过程）

如果都放一行（像我们一样），更新工具状态时要重写整行。opencode 把每种内容拆成独立的 part 行：

```
message 行（容器）
├── part 行 1: type=text, "我来帮你读这个文件"
├── part 行 2: type=tool, tool=read, state=pending → running → completed
└── part 行 3: type=text, "这个文件有 10 行..."
```

### 拆分的好处

1. **流式更新**：assistant 消息的内容是逐 token 到达的。每个 part 可以独立 upsert，不用重写整个消息
2. **独立生命周期**：一个 tool part 从 `pending` → `running` → `completed` 状态变化，只更新这一行，不影响同消息的其他 part
3. **只增不改**：追加一个 part = 一条便宜 INSERT，不用读-改-写整个大 JSON

### opencode 的 12 种 part 类型

| Part 类型 | 用途 |
|-----------|------|
| `TextPart` | 文本内容 |
| `ToolPart` | 工具调用 + 结果（同一行，state 变化） |
| `ReasoningPart` | 模型的推理过程 |
| `FilePart` | 文件/图片 |
| `StepStartPart` | 一步开始标记 |
| `StepFinishPart` | 一步结束标记（带 token 用量） |
| `SessionIdPart` | session ID 标记 |
| `SessionSummaryPart` | session 摘要 |
| ... | 还有更多 |

> 对比我们的单表：只有 `role` + `content` + `tool_calls` + `tool_call_id` 四个字段。够用，但不灵活。

### opencode 怎么存 tool_call

关键区别：**opencode 的工具调用和结果在同一行 part 里**。

```
ToolPart:
  callID: "call_abc123"
  tool: "read"
  state: pending → running → completed
  output: "1  // src/index.ts\n2  ..."  ← 结果直接存在 part 里
```

而我们是两条消息：
- assistant 消息带 `tool_calls`（调什么工具）
- tool 消息带 `tool_call_id` + `content`（工具结果）

这是 OpenAI API 的格式——assistant 发起 tool_call，我们执行后以 `role: "tool"` 消息喂回。opencode 内部用自己的 part 格式，发 API 请求时再转成 OpenAI 格式。

## 对比总结

| | 我们的实现 | opencode |
|---|-----------|----------|
| 表数量 | 1 个（message） | 2 个（message + part） |
| 一条消息 | 一行 | 一个 message 行 + 多个 part 行 |
| tool_call 存储 | JSON 字符串在一行 | 独立的 ToolPart 行 |
| tool 结果 | 另一条 tool 消息 | 同一个 ToolPart 行的 output 字段 |
| 更新方式 | 重写整行 | 独立 upsert 单个 part |
| part 类型 | 4 种 role | 12 种 part type |
| 复杂度 | 低 | 高，但灵活 |

### 什么时候该用两表？

现在不需要。我们的 agent 简单——一条消息就是一行，tool_call 序列化成 JSON 够用。

当你需要这些功能时，就该拆了：
- **流式更新单个 part**（比如 tool 执行状态变化，不想重写整条消息）
- **上下文压缩**（compaction：只保留摘要，删除旧的 tool output）
- **多种内容类型**（reasoning、图片、文件附件等）

> **工程思维**：先简单方案跑起来。等真正的痛点出现（流式更新太贵、类型太多混在一起），再拆。不要提前设计。

## 本课小结

1. **saveMessage** = INSERT + JSON 序列化（tool_calls → JSON 字符串）
2. **loadMessages** = SELECT WHERE session_id + ORDER BY time_created + JSON 反序列化
3. **opencode 的两表设计**：message 是容器，part 是内容，支持 12 种 part 类型
4. **拆分的动机**：流式更新、独立生命周期、只增不改
5. **trade-off**：单表简单但不灵活，两表灵活但复杂。先简单，痛了再拆

下一步：5.4 课——集成到 agent，重启后能恢复对话。
