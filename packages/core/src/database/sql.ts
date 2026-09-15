// packages/core/src/database/sql.ts
// 表结构定义：只管"表长什么样"，不管"怎么连数据库"
// 对照 opencode: packages/core/src/session/sql.ts（表结构）
// opencode 的表复杂得多（session 25+ 字段、message + part 两表、事件溯源），
// 我们简化为 session + message 两张表。
//
// 为什么从 database.ts 拆出来（阶段 16.2）：
//   database.ts 负责"怎么建库、怎么提供连接"（服务层）
//   sql.ts 负责"表长什么样"（结构层）
//   改表结构（加字段）→ 只动 sql.ts
//   改建库方式（换内存库/换路径）→ 只动 database.ts
//   互不影响。

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"

// session 表：一次对话会话的元信息
// 对照 opencode: 它的 SessionTable 有 25+ 字段（cost、tokens、agent、model 等）
// 我们简化为 4 个字段，后续阶段逐步补全
export const sessionTable = sqliteTable("session", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  time_created: integer("time_created").notNull(),
  time_updated: integer("time_updated").notNull(),
})

// message 表：对话消息
// 对照 opencode: 它把消息拆成 message（消息头）+ part（消息内容片段）两表
// 我们简化为单表——一条消息一行
// tool_calls 存为 JSON 字符串（SQLite 没有原生 JSON 类型）
export const messageTable = sqliteTable("message", {
  id: text("id").primaryKey(),
  session_id: text("session_id").notNull(), // 所属会话
  role: text("role").notNull(), // system/user/assistant/tool
  content: text("content"), // 消息内容（tool 消息是工具结果）
  tool_calls: text("tool_calls"), // 工具调用（JSON 字符串，只有 assistant 有）
  tool_call_id: text("tool_call_id"), // 工具调用 ID（只有 tool 消息有）
  time_created: integer("time_created").notNull(),
})
