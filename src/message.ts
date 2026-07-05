// src/message.ts
// Message 存储模块：保存和加载对话消息
// 对照 opencode: packages/core/src/session/sql.ts (MessageTable + PartTable)
// opencode 把消息拆成 message（容器）+ part（内容片段）两表，有 12 种 part 类型
// 我们简化为单表：一条消息一行，tool_calls 存为 JSON 字符串

import { db, messageTable } from "./db"
import { eq, asc } from "drizzle-orm"
import type { Message, ToolCall } from "./types"

// ── Message ↔ DB 行的转换 ──────────────────────────────────
// 核心挑战：Message 里有 tool_calls（对象数组），但 SQLite 只有 TEXT
// 解决：存的时候 JSON.stringify，读的时候 JSON.parse

// Message → DB 行（存的时候调用）
// tool_calls 是数组，要序列化成 JSON 字符串才能存进 TEXT 字段
function messageToRow(sessionId: string, msg: Message) {
  return {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    session_id: sessionId,
    role: msg.role,
    content: msg.content,
    // tool_calls 是对象数组，JSON.stringify 转成字符串
    // 不用 JSON.stringify(msg.tool_calls) 是因为 undefined 会被转成 undefined（不是字符串）
    // 要确保只有有 tool_calls 时才序列化
    tool_calls: msg.tool_calls ? JSON.stringify(msg.tool_calls) : null,
    tool_call_id: msg.tool_call_id || null,
    time_created: Date.now(),
  }
}

// DB 行 → Message（读的时候调用）
// tool_calls 在 DB 里是 JSON 字符串，要 JSON.parse 还原成对象数组
function rowToMessage(row: typeof messageTable.$inferSelect): Message {
  return {
    role: row.role as Message["role"],
    content: row.content,
    // tool_calls 在 DB 里是 JSON 字符串，JSON.parse 还原成数组
    tool_calls: row.tool_calls ? JSON.parse(row.tool_calls) as ToolCall[] : undefined,
    tool_call_id: row.tool_call_id || undefined,
  }
}

// ── CRUD 函数 ──────────────────────────────────────────────

// 保存一条消息到数据库
// 对照 opencode: 它用事件溯源——publish(MessageUpdated 事件) → projector 异步写库
// 我们直接 INSERT
export async function saveMessage(sessionId: string, msg: Message): Promise<void> {
  const row = messageToRow(sessionId, msg)
  await db.insert(messageTable).values(row)
}

// 加载一个 session 的所有消息，按创建时间升序（最早的在前）
// 对照 opencode: 它要 JOIN message + part 两表重新组装（hydrate 函数）
// 我们单表查询，直接转回来就行
export async function loadMessages(sessionId: string): Promise<Message[]> {
  const rows = await db.select().from(messageTable)
    .where(eq(messageTable.session_id, sessionId))
    .orderBy(asc(messageTable.time_created))
    .all()
  return rows.map(rowToMessage)
}
