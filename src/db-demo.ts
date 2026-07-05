// src/db-demo.ts
// 5.1 课教学代码：数据库演示
// 跑法：bun run src/db-demo.ts

import { db, sessionTable } from "./db"

// 1. 插入一条 session
const now = Date.now()
const sessionId = `session-${now}`
await db.insert(sessionTable).values({
  id: sessionId,
  title: "测试会话",
  time_created: now,
  time_updated: now,
})
console.log("=== 插入 session ===")
console.log(`id: ${sessionId}, title: 测试会话`)

// 2. 查询所有 session
const sessions = await db.select().from(sessionTable)
console.log("\n=== 查询所有 session ===")
for (const s of sessions) {
  console.log(`id: ${s.id}, title: ${s.title}, created: ${new Date(s.time_created).toLocaleString()}`)
}

// 3. 按 id 查询单个 session
const found = await db.select().from(sessionTable)
// Drizzle 的查询方式：链式调用
console.log(`\n=== 总共 ${sessions.length} 个 session ===`)
