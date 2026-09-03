// src/session.ts
// Session CRUD 模块：创建、列表、加载会话
// 对照 opencode: packages/opencode/src/session/session.ts
// opencode 的 session 管理远比这复杂（事件溯源、project/workspace 分层、25+ 字段）
// 我们简化为直接 CRUD，后续阶段逐步补全

import { db, sessionTable } from "./db"
import { eq, desc } from "drizzle-orm"

// Session 类型：对应数据库里的一行
// 对照 opencode: 它的 Info 类型有 25+ 字段（cost、tokens、model、metadata 等），嵌套 time/tokens 对象
// 我们简化为 4 个扁平字段
export interface Session {
  id: string
  title: string
  time_created: number
  time_updated: number
}

// 生成 session ID
// 格式：ses_<13位时间戳>_<6位随机>
// 对照 opencode: 它用降序 ULID（按位取反时间戳），让 ORDER BY id 自动按时间倒序
// 我们简化版：时间戳可读，但需要额外 ORDER BY time_updated 来排序
function generateSessionId(): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).slice(2, 8)
  return `ses_${timestamp}_${random}`
}

// 创建一个新 session
// 对照 opencode: session.ts 的 create() 函数
// opencode 用事件溯源：publish(Created 事件) → projector 异步写库
// 我们直接 INSERT，简单直接
export async function createSession(title?: string): Promise<Session> {
  const now = Date.now()
  const session: Session = {
    id: generateSessionId(),
    title: title || `New session - ${new Date().toLocaleString("zh-CN")}`,
    time_created: now,
    time_updated: now,
  }

  await db.insert(sessionTable).values(session)
  return session
}

// 列出所有 session，按更新时间倒序（最近活跃的在前）
// 对照 opencode: session.ts 的 list() 函数
// opencode 支持 project/workspace/path/search 多维过滤，默认 limit 100
// 我们简化为查全部，按 time_updated 倒序
export async function listSessions(): Promise<Session[]> {
  return await db.select().from(sessionTable).orderBy(desc(sessionTable.time_updated)).all()
}

// 按 ID 加载单个 session
// 对照 opencode: session.ts 的 get() 函数
// opencode 找不到时抛 NotFoundError，我们返回 undefined（调用者自己决定怎么处理）
export async function getSession(id: string): Promise<Session | undefined> {
  return await db.select().from(sessionTable).where(eq(sessionTable.id, id)).get()
}

// 更新 session 的标题和更新时间
// 对照 opencode: session.ts 的 update() 函数
// opencode 的 update 支持改 title、metadata、permission 等，还会 publish Updated 事件
export async function updateSession(id: string, title: string): Promise<void> {
  await db.update(sessionTable)
    .set({ title, time_updated: Date.now() })
    .where(eq(sessionTable.id, id))
}
