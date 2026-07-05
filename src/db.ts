// src/db.ts
// 数据库初始化：创建 SQLite 文件 + Drizzle ORM + 表结构
// 对照 opencode: packages/core/src/database/database.ts 和 session/sql.ts
// opencode 的表结构复杂得多（25+ 字段的 session 表、message + part 两表、事件溯源等）

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"
import { drizzle } from "drizzle-orm/bun-sqlite"
import { Database } from "bun:sqlite"

// ── 表结构定义 ──────────────────────────────────────────────
// 用 Drizzle 定义表结构，类比 Python SQLAlchemy 的 declarative_base

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

// ── 数据库初始化 ──────────────────────────────────────────────

// 数据库文件路径（对照 opencode: ~/.local/share/opencode/opencode.db）
const DB_PATH = "opencode-from-scratch.db"

// 创建 SQLite 数据库（bun:sqlite 内置，不需要额外安装）
const sqlite = new Database(DB_PATH)

// 开启 WAL 模式提升并发读写（opencode 也开了这个）
sqlite.run("PRAGMA journal_mode = WAL")

// 用 Drizzle 包装 SQLite
// schema 参数让 Drizzle 知道表结构，后续查询能返回类型安全的结果
export const db = drizzle(sqlite, {
  schema: { sessionTable, messageTable },
})

// 创建表（如果不存在）
// 对照 opencode: 它用 drizzle-kit 的 migration 系统管理表结构
// 我们简化版直接 CREATE TABLE IF NOT EXISTS
sqlite.run(`
  CREATE TABLE IF NOT EXISTS session (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    time_created INTEGER NOT NULL,
    time_updated INTEGER NOT NULL
  )
`)

sqlite.run(`
  CREATE TABLE IF NOT EXISTS message (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT,
    tool_calls TEXT,
    tool_call_id TEXT,
    time_created INTEGER NOT NULL
  )
`)
