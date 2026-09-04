// packages/core/src/database/sql.ts
// 数据库表结构定义（独立文件，与 database.ts 服务分离）
// 对照 opencode: packages/core/src/session/sql.ts
// opencode 把表结构放在各领域自己的 sql.ts（session 的 SessionTable 在 session/sql.ts）
// 我们简化：两张表都放这里，后续阶段再按领域拆分
//
// 为什么拆出来？
// - database.ts 管"怎么建库、怎么提供连接"（服务层）
// - sql.ts 管"表长什么样"（结构层）
// - 服务层和结构层各自独立，改表结构不用动服务，反之亦然

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
