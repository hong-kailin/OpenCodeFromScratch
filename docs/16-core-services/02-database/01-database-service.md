# 16.2 第 2 步：Database 服务——模块级单例 → Effect Service

> 对照代码：`packages/core/src/database/database.ts`、`packages/core/src/database/sql.ts`、
> `packages/core/src/database/database-demo.ts`

## 这一步做什么

把第 1 步搬进来的 `database.ts`（还是模块级单例）改造成 Effect Service。
这是"服务化"的第一个例子——后面 Filesystem / SessionStore / SystemContext 都按同样的三件套模式。

## 之前的问题（模块级单例）

搬移后的 `database.ts` 还是阶段 5-15 的写法：

```typescript
// 模块顶层就执行副作用！
const sqlite = new Database("opencode-from-scratch.db")
sqlite.run("PRAGMA journal_mode = WAL")
export const db = drizzle(sqlite, { schema: { sessionTable, messageTable } })
```

三个问题（16.0.1 详述）：
1. **import 即建库**——副作用在模块顶层，无法控制时机
2. **无法替换**——测试想用内存库？改不了
3. **边界不清晰**——建库逻辑和表结构混在一起

## 解法：拆两个文件 + 服务化

对照 opencode 的做法，我们拆成两个文件：

```
database/
├── sql.ts          # 表结构定义（只管"表长什么样"）
└── database.ts     # Database Service（只管"怎么建库、怎么提供连接"）
```

**为什么拆开？** 服务层和结构层职责不同：
- 改表结构（加字段）→ 只动 sql.ts
- 改建库方式（换内存库/换路径）→ 只动 database.ts
- 互不影响

## 表结构独立：sql.ts

```typescript
// packages/core/src/database/sql.ts
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"

export const sessionTable = sqliteTable("session", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  time_created: integer("time_created").notNull(),
  time_updated: integer("time_updated").notNull(),
})

export const messageTable = sqliteTable("message", {
  id: text("id").primaryKey(),
  session_id: text("session_id").notNull(),
  role: text("role").notNull(),
  content: text("content"),
  tool_calls: text("tool_calls"),
  tool_call_id: text("tool_call_id"),
  time_created: integer("time_created").notNull(),
})
```

## Database Service：三件套

`database.ts` 变成 Service（阶段 11 学过的模式）：

```typescript
import { Context, Effect, Layer } from "effect"
import { drizzle } from "drizzle-orm/bun-sqlite"
import { Database } from "bun:sqlite"
import { sessionTable, messageTable } from "./sql"

// ── 1. Interface：声明能力 ──────────────────
// 这个服务暴露一个 db 实例（drizzle 的类型安全查询接口）
export interface DatabaseServiceApi {
  readonly db: ReturnType<typeof drizzle>
}

// ── 2. Service：tag ────────────────────────
export class DatabaseService extends Context.Service<DatabaseService, DatabaseServiceApi>()(
  "opencode-from-scratch/Database",
) {}

// ── 3. databaseLayer：provide 时才建库 ─────
export const databaseLayer = Layer.effect(
  DatabaseService,
  Effect.gen(function* () {
    const sqlite = new Database("opencode-from-scratch.db")
    sqlite.run("PRAGMA journal_mode = WAL")
    const db = drizzle(sqlite, { schema: { sessionTable, messageTable } })
    sqlite.run(`CREATE TABLE IF NOT EXISTS session (...)`)
    sqlite.run(`CREATE TABLE IF NOT EXISTS message (...)`)

    return DatabaseService.of({ db })
  }),
)
```

**关键变化**：建库副作用从"模块顶层"收进"Layer 函数体"。
只有 `Effect.provide(databaseLayer)` 时才执行——`import` 这个文件不再触发建库。

## 消费方怎么用：yield* Database.Service

```typescript
const countSessions = Effect.gen(function* () {
  const { db } = yield* DatabaseService   // 从 Context 拿 db
  return db.select().from(sessionTable).all().length
})

const result = await Effect.runPromise(
  countSessions.pipe(Effect.provide(databaseLayer)),   // 这里才建库
)
```

对比之前：`import { db } from "./db"` 直接拿单例。
现在：声明"我需要 DatabaseService"，provide 时才真正创建。

## 教 debug：报错怎么读

**场景**：typecheck 报 `sessionTable` 找不到。

```
error TS2300: Duplicate identifier 'sessionTable'
```

排查思路：搬移后表结构从 database.ts 拆到了 sql.ts，可能有地方从两个文件重复导入。
确认所有 import 指向 `./sql`（表结构）或 `./database`（服务+re-export），不要混。

**场景**：运行时 `db` 是 undefined。

排查思路：数据库是 `yield* Database.Service` 拿的——检查是否 `Effect.provide(databaseLayer)`。
如果消费方 Effect 没 provide，Context 里没有 Database 服务，取到 undefined。

## 验证：第 2 步成功标志

```bash
bunx tsc --noEmit                              # 通过
bun run packages/core/src/database/database-demo.ts   # 打印 "Database Service 工作正常"
bun run packages/opencode/src/index.ts run "2+2?"     # CLI 回归（走兼容层）
```

## 这一步用到的工程思维

**"副作用收进 Layer"** 是服务化的核心手法：
- 之前：副作用在模块顶层（import 即触发）
- 现在：副作用在 Layer 函数体（provide 才触发）

这带来一个能力：**按需建库、可替换实现**。测试时想用内存库：
```typescript
const memoryLayer = Layer.effect(DatabaseService, Effect.gen(function* () {
  const sqlite = new Database(":memory:")   // 换成内存库
  // ... 其余一样
}))
```
消费方代码完全不用改——这就是"依赖注入"的价值。

## 下一步

[16.3 第 3 步：Filesystem 服务](../03-filesystem/01-filesystem-service.md)
——封装文件读写 + glob + grep，工具改为从 Context 取。
