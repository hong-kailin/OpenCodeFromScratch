// packages/core/src/database/database.ts
// 阶段 16.2 教学代码：Database Service——模块级单例 → Effect Service
//
// 之前的写法（阶段 5-15）：src/db.ts 是模块级单例
//   import 这个模块的瞬间就建库（new Database + PRAGMA + CREATE TABLE）
//   问题：
//   1. import 即建库——谁 import 谁触发副作用，测试时无法替换
//   2. db 是模块级 export——所有地方直接 import { db }，无法 mock
//   3. 建库时机不可控——无法在"需要时"才建（如测试用 :memory:）
//
// 现在的写法（阶段 16.2）：Database Service（Service 三件套）
//   1. Interface      -- 声明这个服务能做什么：暴露一个 db 实例
//   2. Service        -- tag（唯一标识）
//   3. databaseLayer  -- Layer：provide 时才建库（把副作用收进 Layer）
//   消费方 yield* Database.Service 拿 db，测试时可以换成别的 Layer
//
// 对照 opencode: packages/core/src/database/database.ts
//   opencode 用 effect-drizzle-sqlite 包装，且支持内存库/文件库切换；
//   我们简化：直接用 bun:sqlite + drizzle，建库逻辑收进 Layer

import { Context, Effect, Layer } from "effect"
import { drizzle } from "drizzle-orm/bun-sqlite"
import { Database } from "bun:sqlite"
import { sessionTable, messageTable } from "./sql"

// re-export 表结构：db 实例的 schema 里注册了这两张表，
// session.ts / message.ts 也从这里 import { db, sessionTable }（和之前行为一致）
export { sessionTable, messageTable } from "./sql"

// ── 1. Interface：声明能力 ─────────────────────────────────
// 这个服务只有一个能力：暴露 Drizzle 的 db 实例
// db 的类型由 drizzle() 的返回值推导（带 schema 的类型安全查询）
// 类比 Python: 一个类暴露 self.db（SQLAlchemy session）
export interface DatabaseServiceApi {
  readonly db: ReturnType<typeof drizzle>
}

// ── 2. Service：tag ────────────────────────────────────────
// 固定模板，和 ConfigService/ProviderService 一样
export class DatabaseService extends Context.Service<DatabaseService, DatabaseServiceApi>()(
  "opencode-from-scratch/Database",
) {}

// ── 3. databaseLayer：provide 时才建库 ─────────────────────
// 关键：建库副作用（new Database + PRAGMA + CREATE TABLE）全部收进 Layer 函数体
// 只有 Effect.provide(databaseLayer) 时才执行——"按需建库，而不是 import 即建库"
// 测试时想用内存库，写另一个 Layer 替换即可（16.6 验收会演示）
export const databaseLayer = Layer.effect(
  DatabaseService,
  Effect.gen(function* () {
    // 数据库文件路径（对照 opencode: ~/.local/share/opencode/opencode.db）
    // 之后可以做成可配置（从 ConfigService 读），现在先固定
    const DB_PATH = "opencode-from-scratch.db"

    // 创建 SQLite 数据库（bun:sqlite 内置，不需要额外安装）
    const sqlite = new Database(DB_PATH)

    // 开启 WAL 模式提升并发读写（opencode 也开了这个）
    sqlite.run("PRAGMA journal_mode = WAL")

    // 用 Drizzle 包装 SQLite
    // schema 参数让 Drizzle 知道表结构，后续查询能返回类型安全的结果
    const db = drizzle(sqlite, {
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

    // DatabaseService.of(...) 把实现包装成服务实例
    // 只暴露 db——上层（session/message/后续服务）通过它做类型安全的查询
    return DatabaseService.of({
      db,
    })
  }),
)

// ── 兼容层：模块级 db 导出 ─────────────────────────────────
// 阶段 16.2 的过渡写法（16.5 会移除）：
// session.ts / message.ts 还是模块级函数，直接 import { db }。
// 为了让它们暂时不用改，这里从 Database Service 里"取出" db 再导出。
// 关键教学点：
//   DatabaseService              -- tag，拿服务的钥匙
//   .pipe(Effect.map(s => s.db)) -- 从服务实例取 db 属性（返回 Effect<db>）
//   Effect.provide(..., databaseLayer) -- 喂入实现（这才触发建库）
//   Effect.runSync               -- 同步执行（模块加载时跑一次）
// 对比之前：副作用从"import 即建库"变成"provide 时建库"，这里显式 provide 了一次。
// 16.5 session/message 服务化后，这个模块级导出会被删掉。
export const db = Effect.runSync(
  Effect.provide(
    DatabaseService.pipe(Effect.map((service) => service.db)),
    databaseLayer,
  ),
)
