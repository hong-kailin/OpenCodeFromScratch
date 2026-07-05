// src/session-demo.ts
// 5.2 课教学代码：Session CRUD 演示
// 跑法：bun run src/session-demo.ts
// 演示 createSession、listSessions、getSession、updateSession 四个操作

import { createSession, listSessions, getSession, updateSession } from "./session"

// 1. 创建 3 个 session
console.log("=== 创建 session ===")
const s1 = await createSession("第一个会话")
console.log(`  创建: id=${s1.id}, title="${s1.title}"`)

const s2 = await createSession("第二个会话")
console.log(`  创建: id=${s2.id}, title="${s2.title}"`)

const s3 = await createSession()
console.log(`  创建: id=${s3.id}, title="${s3.title}"`)

// 2. 列出所有 session（按 time_updated 倒序）
console.log("\n=== 列出所有 session ===")
const sessions = await listSessions()
for (const s of sessions) {
  console.log(`  id=${s.id}, title="${s.title}", updated=${new Date(s.time_updated).toLocaleString("zh-CN")}`)
}
console.log(`  共 ${sessions.length} 个 session`)

// 3. 按 ID 加载单个 session
console.log("\n=== 按 ID 加载 ===")
const loaded = await getSession(s2.id)
if (loaded) {
  console.log(`  找到: id=${loaded.id}, title="${loaded.title}"`)
} else {
  console.log("  没找到")
}

// 查一个不存在的 ID
const notFound = await getSession("ses_does_not_exist")
console.log(`  查不存在的 ID: ${notFound === undefined ? "返回 undefined ✓" : "不应该到这里"}`)

// 4. 更新 session 标题
console.log("\n=== 更新 session 标题 ===")
await updateSession(s1.id, "改过的标题")
const updated = await getSession(s1.id)
console.log(`  更新后: title="${updated?.title}"`)

// 5. 再次列出，验证排序（s1 的 time_updated 变了，应该排到最前）
console.log("\n=== 更新后重新列出（s1 应该在最前）===")
const sessions2 = await listSessions()
for (const s of sessions2) {
  console.log(`  id=${s.id}, title="${s.title}"`)
}
