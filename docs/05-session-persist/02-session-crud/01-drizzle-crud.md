# 5.2 Drizzle CRUD：用代码操作数据库

> 本课目标：学会用 Drizzle ORM 做 CRUD（增删改查），理解链式查询构建器，为下一步写 session 模块打基础。

## 上一课回顾

上一课我们学了 SQL 的四个基本操作：`INSERT`、`SELECT`、`UPDATE`、`DELETE`，用 `sqlite3` 命令行直接敲 SQL。

但实际开发中，我们不会在代码里手写 SQL 字符串——那样没有类型安全、容易 SQL 注入、不好维护。我们用 **ORM**（Object-Relational Mapping，对象关系映射）。

## ORM 是什么

ORM 让你用**代码**操作数据库，不用手写 SQL。

| 手写 SQL | 用 ORM |
|----------|--------|
| `SELECT * FROM session WHERE id = 'xxx'` | `db.select().from(sessionTable).where(eq(sessionTable.id, 'xxx'))` |
| `INSERT INTO session VALUES (...)` | `db.insert(sessionTable).values({...})` |
| 字符串拼接，容易 SQL 注入 | 参数自动转义，防注入 |
| 返回 `any`，没有类型提示 | 返回有类型的对象，IDE 能自动补全 |

> Python 类比：Drizzle 之于 SQLite，就像 SQLAlchemy 之于 Python sqlite3。

Drizzle 的设计哲学是**像 SQL 一样**——它的 API 几乎是 SQL 的镜像，你写的 TS 代码读起来就像 SQL。不像有些 ORM 把 SQL 完全藏起来（比如 Django ORM），Drizzle 让你清楚地知道每行代码生成什么 SQL。

## Drizzle CRUD 四件套

我们已经有 `src/db.ts` 里定义好的表和 `db` 实例。现在学怎么用它做 CRUD。

### 1. INSERT：插入数据

```ts
import { db, sessionTable } from "./db"

// 插入一行
await db.insert(sessionTable).values({
  id: "session-1",
  title: "测试会话",
  time_created: Date.now(),
  time_updated: Date.now(),
})

// 插入多行
await db.insert(sessionTable).values([
  { id: "session-2", title: "会话二", time_created: Date.now(), time_updated: Date.now() },
  { id: "session-3", title: "会话三", time_created: Date.now(), time_updated: Date.now() },
])
```

对应的 SQL：
```sql
INSERT INTO session (id, title, time_created, time_updated)
VALUES ('session-1', '测试会话', 1700000000, 1700000000)
```

> **类型安全**：`.values()` 的参数会根据表定义自动检查类型。写错字段名或类型会报错。比如 `time_created` 是 `integer`，你传字符串会报错。

### 2. SELECT：查询数据

```ts
// 查询所有行
const allSessions = await db.select().from(sessionTable)
// 返回：[{ id: "session-1", title: "测试会话", time_created: ..., time_updated: ... }]

// 只查特定列
const idsOnly = await db.select({ id: sessionTable.id }).from(sessionTable)
// 返回：[{ id: "session-1" }, { id: "session-2" }]
```

对应的 SQL：
```sql
SELECT * FROM session;             -- db.select().from(sessionTable)
SELECT id FROM session;            -- db.select({ id: sessionTable.id }).from(sessionTable)
```

> Python 类比：`all_sessions = conn.execute("SELECT * FROM session").fetchall()`，但 Drizzle 的返回值有类型，不是裸 dict。

### 3. WHERE：条件查询

这是最常用的。Drizzle 提供 `eq`、`gt`、`lt`、`like` 等操作符函数：

```ts
import { eq, gt, lt, like, and, or, isNull } from "drizzle-orm"

// WHERE id = 'session-1'
const s1 = await db.select().from(sessionTable).where(eq(sessionTable.id, "session-1"))

// WHERE time_created > 1700000000
const recent = await db.select().from(sessionTable).where(gt(sessionTable.time_created, 1700000000))

// WHERE title LIKE '%测试%'
const matched = await db.select().from(sessionTable).where(like(sessionTable.title, "%测试%"))

// WHERE time_created > 1700000000 AND title LIKE '%测试%'
const filtered = await db.select().from(sessionTable).where(
  and(
    gt(sessionTable.time_created, 1700000000),
    like(sessionTable.title, "%测试%"),
  )
)
```

| SQL | Drizzle 函数 |
|-----|-------------|
| `=` | `eq(column, value)` |
| `!=` | `ne(column, value)` |
| `>` | `gt(column, value)` |
| `<` | `lt(column, value)` |
| `>=` | `gte(column, value)` |
| `LIKE` | `like(column, pattern)` |
| `AND` | `and(...conditions)` |
| `OR` | `or(...conditions)` |
| `IS NULL` | `isNull(column)` |

> 这些函数返回**条件对象**，不是布尔值。Drizzle 用它们拼出 SQL 的 WHERE 子句。

### 4. ORDER BY + LIMIT：排序和限制

```ts
import { desc, asc } from "drizzle-orm"

// 按创建时间降序（最新的在前）
const newest = await db.select().from(sessionTable).orderBy(desc(sessionTable.time_created))

// 只取前 5 个
const top5 = await db.select().from(sessionTable)
  .orderBy(desc(sessionTable.time_created))
  .limit(5)
```

对应的 SQL：
```sql
SELECT * FROM session ORDER BY time_created DESC;
SELECT * FROM session ORDER BY time_created DESC LIMIT 5;
```

### 5. UPDATE：修改数据

```ts
// 把 session-1 的标题改成 "新标题"
await db.update(sessionTable)
  .set({ title: "新标题", time_updated: Date.now() })
  .where(eq(sessionTable.id, "session-1"))
```

对应的 SQL：
```sql
UPDATE session SET title = '新标题', time_updated = 1700000001 WHERE id = 'session-1'
```

> **UPDATE 一定要带 WHERE！** 和 SQL 一样，不带 WHERE 会修改所有行。

### 6. DELETE：删除数据

```ts
// 删除 session-1
await db.delete(sessionTable).where(eq(sessionTable.id, "session-1"))

// 删除所有（危险！）
// await db.delete(sessionTable)  // ← 不带 where 就是全删
```

对应的 SQL：
```sql
DELETE FROM session WHERE id = 'session-1';
```

## 链式调用

你可能注意到了，Drizzle 的查询是**链式调用**（method chaining）：

```ts
db.select()                    // 选择
  .from(sessionTable)          // 从哪个表
  .where(eq(...))              // 条件
  .orderBy(desc(...))          // 排序
  .limit(5)                    // 限制
```

每个方法返回一个新的查询构建器对象，可以继续链式调用。顺序大致和 SQL 一样：
`SELECT → FROM → WHERE → ORDER BY → LIMIT`

> Python 类比：像 SQLAlchemy 的 `session.query(User).filter(User.name == 'Alice').order_by(User.id.desc()).limit(5)`。

## get() vs all()

Drizzle 在 SQLite 上有两个特殊的结尾方法：

```ts
// .all() — 返回数组（可能为空）
const all = await db.select().from(sessionTable).all()
// [{ id: 'session-1', ... }, { id: 'session-2', ... }]

// .get() — 返回单行（找不到返回 undefined）
const one = await db.select().from(sessionTable).where(eq(sessionTable.id, 'xxx')).get()
// { id: 'xxx', ... } 或 undefined
```

| 方法 | 返回 | 用途 |
|------|------|------|
| `.all()` | `T[]` | 查多行 |
| `.get()` | `T \| undefined` | 查单行（按主键、唯一条件） |

> 不加 `.all()` 或 `.get()`，默认也是 `.all()`。

## 本课小结

1. **ORM** 让你用代码操作数据库，不用手写 SQL——有类型安全、防注入
2. **Drizzle 的 API 镜像 SQL**：`select().from().where().orderBy().limit()` 读起来就像 SQL
3. **CRUD 四件套**：`insert().values()`、`select().from()`、`update().set().where()`、`delete().where()`
4. **条件函数**：`eq`、`gt`、`lt`、`like`、`and`、`or`、`isNull`
5. **`.get()`** 查单行，**`.all()`** 查多行

下一步：[5.2 Session ID 生成](./02-session-id.md) —— 怎么生成唯一 ID。
