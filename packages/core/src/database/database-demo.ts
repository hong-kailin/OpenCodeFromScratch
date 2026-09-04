// packages/core/src/database/database-demo.ts
// 阶段 16.2 教学代码：Database Service——从"模块级单例"到"Effect Service"
// 跑法：bun run packages/core/src/database/database-demo.ts
//
// 本 demo 演示核心转变：
//   之前（阶段 5-15）：import "./db" 的瞬间就建库（副作用在模块顶层）
//   现在（阶段 16.2）：建库副作用收进 databaseLayer，provide 时才执行
//
// 关键 API：
//   DatabaseService          -- tag（拿服务的钥匙）
//   yield* DatabaseService   -- 从 Context 取服务实例（拿到 db）
//   Effect.provide(..., databaseLayer) -- 喂入实现（这才触发建库）
//   Effect.runPromise        -- 把 Effect 跑起来

import { Effect } from "effect"
import { DatabaseService, databaseLayer } from "./database"
import { sessionTable } from "./sql"

// 定义一个"消费方" Effect：从 Context 拿 Database 服务，用它查 session 表
// 这个 Effect 本身不知道数据库在哪、怎么建——只声明"我需要 DatabaseService"
// 类比 Python: FastAPI 的 Depends(get_db) 声明"我需要数据库"
const countSessions = Effect.gen(function* () {
  // yield* DatabaseService：从 Context 取出服务实例
  const { db } = yield* DatabaseService
  // 用 drizzle 的类型安全查询数一下 session 表有多少行
  const rows = db.select().from(sessionTable).all()
  return rows.length
})

// 跑起来：Effect.provide(效果, databaseLayer) 把实现塞进 Context
// 注意：databaseLayer 的函数体在这里才执行——建库副作用发生在 provide 时，
// 而不是"import database.ts"时（对比阶段 15 的模块级单例）
const result = await Effect.runPromise(
  countSessions.pipe(Effect.provide(databaseLayer)),
)

console.log("Database Service 工作正常！")
console.log(`session 表当前有 ${result} 行（新建的空数据库）`)
console.log()
console.log("对比阶段 15 的 db.ts：")
console.log("  之前：import './db' 就建库（副作用在模块顶层，无法替换）")
console.log("  现在：provide(databaseLayer) 才建库（副作用在 Layer 里，可换实现）")
