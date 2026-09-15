# 16.2 Database 服务：模块级单例 → Effect Service

> 阶段 16 的地图见 [16.0 总览](../00-overview/01-overview.md)。
> 本课是"服务化"的第一个例子——后面 Filesystem / SessionStore / SystemContext
> 都按同样的三件套模式，先把这一课吃透。

## 这一步做什么

把第 1 步搬进来的 `database.ts`（还是模块级单例）改造成 **Database Service**：
建库副作用从"import 即执行"收进"provide 时才执行"，消费方改为 `yield* DatabaseService`。

对照代码：`packages/core/src/database/sql.ts`、`database.ts`、`database-demo.ts`

## 之前的问题（模块级单例）

搬移后的 `database.ts` 还是阶段 5-15 的写法：

```typescript
// 模块顶层就执行副作用！
const sqlite = new Database("opencode-from-scratch.db")
sqlite.run("PRAGMA journal_mode = WAL")
export const db = drizzle(sqlite, { schema: { sessionTable, messageTable } })
```

三个问题：

1. **import 即建库**——副作用在模块顶层，谁 import 谁触发建库，时机不可控
2. **无法替换**——所有地方 `import { db }`，测试想用内存库？改不了
3. **职责混在一起**——建库逻辑和表结构定义写在一个文件里，改一个要动另一个

## 解法总览

```
database/
├── sql.ts          # 表结构定义（只管"表长什么样"）
├── database.ts     # Database Service（只管"怎么建库、怎么提供连接"）
└── database-demo.ts # 教学 demo（消费方怎么 yield* DatabaseService）
```

关键手法：**把副作用收进 Layer 函数体**。`import` 这个文件不再建库，
只有 `Effect.provide(databaseLayer)` 时才建库。

## 表结构独立：sql.ts

表结构从 database.ts 拆到 sql.ts（内容就是原来的 sessionTable / messageTable，
原样搬过来，一行没改）：

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

**为什么拆出来？** 服务层和结构层职责不同，改表结构（加字段）只动 sql.ts，
改建库方式（换内存库/换路径）只动 database.ts，互不影响。

## Database Service：三件套

`database.ts` 变成 Service（阶段 11 学过的模式）：

```typescript
import { Context, Effect, Layer } from "effect"
import { drizzle } from "drizzle-orm/bun-sqlite"
import { Database } from "bun:sqlite"
import { sessionTable, messageTable } from "./sql"

// 1. Interface：声明能力——这个服务暴露一个 db 实例
export interface DatabaseServiceApi {
  readonly db: ReturnType<typeof drizzle>
}

// 2. Service：tag（唯一标识）
export class DatabaseService extends Context.Service<DatabaseService, DatabaseServiceApi>()(
  "opencode-from-scratch/Database",
) {}

// 3. databaseLayer：provide 时才建库
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

**关键变化**：建库副作用（new Database + PRAGMA + CREATE TABLE）从"模块顶层"
收进"Layer 函数体"。只有 `Effect.provide(databaseLayer)` 时才执行——`import`
这个文件不再触发建库。

## 过渡桥接：让旧消费者继续工作

这里有个现实问题：`session.ts` / `message.ts` 还是模块级 async 函数，
直接 `import { db }`。模块级函数没有 Context，**无法 yield* 服务拿 db**。

所以在它们服务化（16.6）之前，从 Service 里"取出"db 再导出，让旧代码不破：

```typescript
// database.ts 末尾
export const db = Effect.runSync(
  Effect.provide(
    DatabaseService.pipe(Effect.map((service) => service.db)),
    databaseLayer,
  ),
)
```

拆开看这条链：

- `DatabaseService` —— tag，拿服务的"钥匙"
- `.pipe(Effect.map((service) => service.db))` —— 从服务实例取 db 属性（得到 Effect\<db>）
- `Effect.provide(..., databaseLayer)` —— 喂入实现（**这里才触发建库**）
- `Effect.runSync` —— 同步执行（模块加载时跑一次）

> **这个桥接是过渡方案，不是最终形态。** 它仍是"模块加载即建库"，但注意区别：
> 桥接只是把 Service 创建的实例"取一次"给旧消费者用；真正消费 db 的新代码
> （后续的 Effect 服务）会 `yield* DatabaseService` + provide 自定义 Layer，
> 完全绕开它。16.6 SessionStore 服务化后会删掉这里。

## 消费方怎么用：yield* Database.Service

`database-demo.ts` 演示了服务化后的消费方式（跑一下）：

```bash
bun run packages/core/src/database/database-demo.ts
```

```typescript
// 消费方只声明"我需要 DatabaseService"，不关心库怎么建
const countSessions = Effect.gen(function* () {
  const { db } = yield* DatabaseService
  return db.select().from(sessionTable).all().length
})

// provide 时才真正建库、注入
const result = await Effect.runPromise(
  countSessions.pipe(Effect.provide(databaseLayer)),
)
```

对比之前 `import { db } from "./db"` 直接拿单例，现在"声明需要 → provide 时注入"。

## 教 debug

**场景 1**：typecheck 报 `Duplicate identifier 'sessionTable'`。

排查：表结构从 database.ts 拆到了 sql.ts，可能有文件从两个文件重复导入。
统一约定：**表结构从 `./sql` 拿，服务从 `./database` 拿**，不要混。

**场景 2**：运行时 `yield* DatabaseService` 拿到 undefined / 报服务不存在。

排查：消费方 Effect 没 `Effect.provide(databaseLayer)`。Context 里没有
Database 服务时取不到，检查调用处是否 provide。

## 验证：这一步成功标志

```bash
bunx tsc --noEmit                              # 通过
bun run packages/core/src/database/database-demo.ts   # 打印 "Database Service 工作正常"
bun run packages/opencode/src/index.ts run "2+2?"     # CLI 回归（走桥接）
```

## 这一步解决了什么、还没解决什么

服务化是逐步的。这步（Database 服务）之后，回顾开头三个问题：

| 问题 | 解决了吗 | 说明 |
|------|---------|------|
| 1. import 即建库 | ✅ | 建库副作用收进 Layer，provide 才执行 |
| 2. 无法 mock db | ✅ | 消费方 `yield* DatabaseService`，测试换 Layer |
| 3. 职责没有边界 | ❌ | `session.ts`/`message.ts` 仍是模块级函数，直接 `import { db }` |

> 问题 3 的本质不是"db 不是服务"，而是"存储能力没有一个统一归属"。
> 这步只解决了"数据库连接怎么给"；session/message 的合并服务化在 16.6。
> 渐进式就是这么回事：**每步解决一个问题**，别期待一步到位。

## 工程思维：把副作用收进 Layer

"副作用收进 Layer"是服务化的核心手法。它带来的能力是**按需建库、可替换实现**：

```typescript
// 测试时想用内存库，写一个替换 Layer，消费方代码不用改
const memoryLayer = Layer.effect(DatabaseService, Effect.gen(function* () {
  const sqlite = new Database(":memory:")
  // ... 建表等，和 databaseLayer 一样
  return DatabaseService.of({ db: drizzle(sqlite, { schema: { sessionTable, messageTable } }) })
}))
```

这就是"依赖注入"的价值——实现可替换，声明不变。

## 对照 opencode

| 我们 | opencode |
|------|----------|
| `DatabaseService` + `databaseLayer` | `core/src/database/database.ts` 的 Service + layer |
| 文件路径 `opencode-from-scratch.db` | `Global.Path.data/opencode.db`（带渠道区分） |
| 只开 `journal_mode = WAL` | 一串 PRAGMA（WAL/synchronous/busy_timeout/foreign_keys） |
| CREATE TABLE IF NOT EXISTS | drizzle-kit migration 系统 |
| 简化：不支持内存/文件切换 | `layerFromPath()` 支持 `:memory:` 和绝对路径 |

opencode 用 `EffectDrizzleSqlite.makeWithDefaults()` 包装，我们直接用 bun:sqlite + drizzle，
核心思想一致：**建库副作用在 Layer 里，消费方从 Context 取 db**。

## 小结

第 2 步做完：
- 表结构独立（sql.ts），数据库访问服务化（Database Service）
- 建库副作用收进 Layer，"import 即建库"消失
- 桥接导出让 session/message 暂时不破（16.6 移除）

## 下一步

[16.3 FileSystem 服务](../03-filesystem/01-filesystem-service.md)
——把散在各工具里的文件操作收口成一个服务，工具改为从 Context 取。
