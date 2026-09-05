// packages/core/src/session/store.ts
// 阶段 16.5 教学代码：SessionStore Service——session + message 存储服务化
//
// 之前（阶段 5-15）：session.ts 和 message.ts 是模块级 async 函数
//   import { createSession } from "./session"     —— 直接 import 模块级 db 单例
//   import { saveMessage } from "./message"
//   问题：
//   1. 存储逻辑拆在两个文件，职责分散（session 一个、message 一个）
//   2. 都是模块级函数 + 模块级 db，测试时无法替换数据库
//   3. 没有"存储"这个概念的边界——谁需要存储就从哪 import 函数
//
// 现在（阶段 16.5）：SessionStore Service（三件套）
//   1. Interface     -- 声明能力：session CRUD + message 存取
//   2. Service       -- tag
//   3. sessionStoreLayer -- 依赖 Database Service，provide 时拿 db
//   消费方 yield* SessionStore 存取会话/消息，测试时可换内存数据库的 Layer
//
// 对照 opencode: packages/core/src/session/store.ts
//   opencode 的 SessionStore 有 get/context/runnerContext/message 等方法
//   （配合事件溯源，阶段 17 会演进）
//   我们简化：把原来两个模块的函数合并，Effect 化，依赖 Database

import { Context, Effect, Layer } from "effect"
import { eq, desc, asc } from "drizzle-orm"
import type { Message, ToolCall } from "@opencode-from-scratch/schema"
import { DatabaseService } from "../database/database"
import { sessionTable, messageTable } from "../database/sql"

// ── Session 类型 ──────────────────────────────────────────
// 对应数据库里的一行
// 对照 opencode: 它的 Info 类型有 25+ 字段（cost、tokens、model、metadata 等）
// 我们简化为 4 个扁平字段
export interface Session {
  id: string
  title: string
  time_created: number
  time_updated: number
}

// ── 1. Interface：声明能力 ────────────────────────────────
// 把原来 session.ts（4 个函数）+ message.ts（2 个函数）的能力合并
// 全部返回 Effect（异步操作包进 Effect，和 16.2 Database 服务一致）
export interface SessionStoreApi {
  // session CRUD
  readonly create: (title?: string) => Effect.Effect<Session>
  readonly list: () => Effect.Effect<Session[]>
  readonly get: (id: string) => Effect.Effect<Session | undefined>
  readonly update: (id: string, title: string) => Effect.Effect<void>
  // message 存取
  readonly saveMessage: (sessionId: string, msg: Message) => Effect.Effect<void>
  readonly loadMessages: (sessionId: string) => Effect.Effect<Message[]>
}

// ── 2. Service：tag ───────────────────────────────────────
export class SessionStore extends Context.Service<SessionStore, SessionStoreApi>()(
  "opencode-from-scratch/SessionStore",
) {}

// ── 内部工具函数 ──────────────────────────────────────────

// 生成 session ID
// 格式：ses_<13位时间戳>_<6位随机>
// 对照 opencode: 它用降序 ULID，我们简化版用时间戳
function generateSessionId(): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).slice(2, 8)
  return `ses_${timestamp}_${random}`
}

// Message → DB 行（存的时候调用）
// tool_calls 是数组，要序列化成 JSON 字符串才能存进 TEXT 字段
function messageToRow(sessionId: string, msg: Message) {
  return {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    session_id: sessionId,
    role: msg.role,
    content: msg.content,
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
    tool_calls: row.tool_calls ? JSON.parse(row.tool_calls) as ToolCall[] : undefined,
    tool_call_id: row.tool_call_id || undefined,
  }
}

// ── 3. sessionStoreLayer：provide 时拿 db ─────────────────
// 关键教学点（Layer 依赖 Layer）：
//   sessionStoreLayer 需要 db（drizzle 实例）——从 Database Service 取
//   这就是 11.3 课学的"Layer 依赖 Layer"：yield* DatabaseService
//   组装时必须先 provide Database，sessionStoreLayer 才有东西可用
export const sessionStoreLayer = Layer.effect(
  SessionStore,
  Effect.gen(function* () {
    // 从 Context 取 Database 服务，拿到 db 实例
    // 对比之前：模块级函数直接 import db 单例；现在从服务拿
    const { db } = yield* DatabaseService

    return SessionStore.of({
      // 创建新 session
      create: Effect.fn("SessionStore.create")(function* (title?: string) {
        const now = Date.now()
        const session: Session = {
          id: generateSessionId(),
          title: title || `New session - ${new Date().toLocaleString("zh-CN")}`,
          time_created: now,
          time_updated: now,
        }
        yield* Effect.promise(() => db.insert(sessionTable).values(session))
        return session
      }),

      // 列出所有 session，按更新时间倒序
      list: Effect.fn("SessionStore.list")(function* () {
        // drizzle bun-sqlite 的 .all() 是【同步】的（直接返回数组，不是 Promise）
        // 所以用 Effect.sync 包同步操作（Effect.promise 会报"没有 then 方法"）
        return yield* Effect.sync(() =>
          db.select().from(sessionTable).orderBy(desc(sessionTable.time_updated)).all(),
        )
      }),

      // 按 ID 加载单个 session（找不到返回 undefined）
      get: Effect.fn("SessionStore.get")(function* (id: string) {
        return yield* Effect.sync(() =>
          db.select().from(sessionTable).where(eq(sessionTable.id, id)).get(),
        )
      }),

      // 更新 session 标题和更新时间
      update: Effect.fn("SessionStore.update")(function* (id: string, title: string) {
        yield* Effect.promise(() =>
          db.update(sessionTable)
            .set({ title, time_updated: Date.now() })
            .where(eq(sessionTable.id, id)),
        )
      }),

      // 保存一条消息
      saveMessage: Effect.fn("SessionStore.saveMessage")(function* (sessionId: string, msg: Message) {
        const row = messageToRow(sessionId, msg)
        yield* Effect.promise(() => db.insert(messageTable).values(row))
      }),

      // 加载一个 session 的所有消息，按创建时间升序
      loadMessages: Effect.fn("SessionStore.loadMessages")(function* (sessionId: string) {
        const rows = yield* Effect.sync(() =>
          db.select().from(messageTable)
            .where(eq(messageTable.session_id, sessionId))
            .orderBy(asc(messageTable.time_created))
            .all(),
        )
        return rows.map(rowToMessage)
      }),
    })
  }),
)

