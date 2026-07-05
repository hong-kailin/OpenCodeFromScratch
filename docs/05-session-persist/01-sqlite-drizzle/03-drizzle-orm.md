# 5.1 ORM 与 Drizzle：用代码操作数据库

> 本课目标：理解 ORM 是什么、为什么不直接写 SQL、Drizzle 的基本用法。

## 为什么不直接写 SQL

上面的 `bun:sqlite` 直接写 SQL 字符串就能用，为什么还要用 ORM？

### 问题 1：SQL 注入

```ts
// 用户输入的名字
const name = "Alice'); DROP TABLE users;--"

// 直接拼接 SQL（危险！）
sqlite.run(`INSERT INTO users VALUES ('1', '${name}')`)
// 实际执行的 SQL：INSERT INTO users VALUES ('1', 'Alice'); DROP TABLE users;--')
// → 插入了一条数据，然后删了整张表！

// 用 ORM（安全）
db.insert(usersTable).values({ id: "1", name: name })
// ORM 自动转义特殊字符，不会执行恶意 SQL
```

### 问题 2：没有类型检查

```ts
// 直接写 SQL：返回 any，TS 不知道字段类型
const rows = sqlite.query("SELECT * FROM session").all()
rows[0].titel  // 拼错了（title 写成 titel），TS 不报错，运行时 undefined

// 用 ORM：返回类型安全的结果
const sessions = await db.select().from(sessionTable)
sessions[0].titel  // TS 报错：Property 'titel' does not exist
sessions[0].title  // ✅ 有类型提示
```

### 问题 3：不好维护

表结构改了（比如加了个字段），所有 SQL 字符串都要手动找出来改。ORM 只改一处表定义，所有查询自动更新。

## ORM 是什么

ORM（Object-Relational Mapping，对象关系映射）——**用代码对象操作数据库，不写 SQL 字符串**。

你用代码定义表结构（对象），ORM 帮你生成 SQL 执行，并返回类型安全的结果：

```ts
// 定义表结构（写一次）
const sessionTable = sqliteTable("session", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
})

// 插入数据（ORM 生成 INSERT 语句）
await db.insert(sessionTable).values({
  id: "session-1",
  title: "测试会话",
})

// 查询数据（ORM 生成 SELECT，返回类型安全的结果）
const sessions = await db.select().from(sessionTable)
```

> Python 类比：SQLAlchemy。`class Session(Base): __tablename__ = "session"`，然后 `session.query(Session).all()`。

## Drizzle ORM

Drizzle 是 TypeScript 生态的 ORM，特点是**轻量、类型安全、接近 SQL**。不像其他 ORM（如 Prisma）那样隐藏 SQL，Drizzle 的 API 和 SQL 结构对应：

| SQL | Drizzle |
|-----|---------|
| `SELECT * FROM session` | `db.select().from(sessionTable)` |
| `SELECT * FROM session WHERE id = ?` | `db.select().from(sessionTable).where(eq(sessionTable.id, ?))` |
| `INSERT INTO session VALUES (...)` | `db.insert(sessionTable).values(...)` |
| `UPDATE session SET title = ? WHERE id = ?` | `db.update(sessionTable).set({ title: ? }).where(eq(sessionTable.id, ?))` |
| `DELETE FROM session WHERE id = ?` | `db.delete(sessionTable).where(eq(sessionTable.id, ?))` |

**会 SQL 就会 Drizzle**——API 和 SQL 一一对应，只是换成函数调用。

### 插入数据（INSERT）

```ts
await db.insert(sessionTable).values({
  id: "session-1",
  title: "测试会话",
  time_created: Date.now(),
  time_updated: Date.now(),
})
// 等价 SQL: INSERT INTO session (id, title, time_created, time_updated) VALUES (?, ?, ?, ?)
```

### 查询所有数据（SELECT）

```ts
const sessions = await db.select().from(sessionTable)
// 等价 SQL: SELECT * FROM session
// sessions 类型自动推断：{ id: string, title: string, time_created: number, time_updated: number }[]
```

### 条件查询（WHERE）

```ts
import { eq } from "drizzle-orm"

const result = await db.select().from(messageTable).where(eq(messageTable.session_id, "session-1"))
// 等价 SQL: SELECT * FROM message WHERE session_id = 'session-1'
```

> `eq` 是 Drizzle 的操作符，意思是"等于"。还有 `gt`（大于）、`lt`（小于）等。

## 安装

```bash
bun add drizzle-orm
```

`bun:sqlite` 是 Bun 内置的，不需要额外安装。

## 本课小结

1. **直接写 SQL 的问题**：SQL 注入、没有类型检查、不好维护
2. **ORM**：用代码对象操作数据库，类型安全、防注入
3. **Drizzle**：API 和 SQL 一一对应，会 SQL 就会 Drizzle
4. **基本操作**：insert（插入）、select（查询）、where（条件）

下一步：[5.1 表结构设计](./04-table-design.md) —— 设计 session 和 message 表。
