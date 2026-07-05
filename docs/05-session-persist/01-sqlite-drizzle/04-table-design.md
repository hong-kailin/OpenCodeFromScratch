# 5.1 表结构设计与建表

> 本课目标：设计 session 和 message 两张表，用 Drizzle 定义表结构，创建数据库。

## 数据模型思考

我们的 agent 有什么数据需要存？

1. **会话（Session）**：一次对话就是一次会话，有标题、创建时间
2. **消息（Message）**：会话里的每条消息（user/assistant/tool），属于某个会话

这是一个**一对多关系**：一个 session 有多条 message，一条 message 属于一个 session。

```
Session（会话）
  ├── Message: system "你是助手"
  ├── Message: user "你好"
  ├── Message: assistant "你好！"
  ├── Message: user "1+1=?"
  └── Message: assistant "2"
```

## session 表

| 字段 | 类型 | 说明 | 为什么需要 |
|------|------|------|-----------|
| `id` | text PK | 会话 ID | 唯一标识一个会话 |
| `title` | text | 会话标题 | 给用户看，区分不同会话 |
| `time_created` | integer | 创建时间 | 按时间排序 |
| `time_updated` | integer | 更新时间 | 知道最后活跃时间 |

## message 表

| 字段 | 类型 | 说明 | 为什么需要 |
|------|------|------|-----------|
| `id` | text PK | 消息 ID | 唯一标识一条消息 |
| `session_id` | text | 所属会话 | **外键**，关联到 session 表 |
| `role` | text | 角色 | system/user/assistant/tool |
| `content` | text | 消息内容 | 文本内容 |
| `tool_calls` | text | 工具调用 | JSON 字符串，只有 assistant 有 |
| `tool_call_id` | text | 工具调用 ID | 只有 tool 消息有 |
| `time_created` | integer | 创建时间 | 按时间排序 |

## 什么是外键

`message.session_id` 是**外键**（foreign key）——它指向 `session.id`，表示这条消息属于哪个会话。

```
session 表                          message 表
┌──────────┬─────────┐            ┌──────┬─────────────┐
│ id       │ title   │            │ id   │ session_id  │
├──────────┼─────────┤            ├──────┼─────────────┤
│ session-1│ 测试会话 │◄───────────│ msg-1│ session-1   │
│ session-2│ 另一个   │            │ msg-2│ session-1   │
└──────────┴─────────┘            │ msg-3│ session-2   │
                                  └──────┴─────────────┘
```

session_id = "session-1" 的消息都属于"测试会话"。查询一个会话的所有消息就是 `WHERE session_id = 'session-1'`。

> Python 类比：SQLAlchemy 的 `ForeignKey`，或者 Django 的 `models.ForeignKey`。

## 为什么 tool_calls 存 JSON 字符串

SQLite 没有"数组"或"对象"类型——只有 text（文本）、integer（整数）等基本类型。tool_calls 是个数组，存不进去。

解决方法：把数组**序列化成 JSON 字符串**存到 text 字段：

```ts
// 存入数据库前：对象 → JSON 字符串
const toolCallsStr = JSON.stringify([{ id: "call_1", function: { name: "read", arguments: "{}" } }])
// 存入数据库：tool_calls = '[{"id":"call_1","function":{"name":"read","arguments":"{}"}}]'

// 从数据库读出后：JSON 字符串 → 对象
const toolCalls = JSON.parse(row.tool_calls)
```

> 对照 opencode：它的 `data` 字段也是这样——存 JSON 字符串，用 Schema 解码。

## 用 Drizzle 定义表

看 [`src/db.ts`](../../../src/db.ts)：

```ts
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"
import { drizzle } from "drizzle-orm/bun-sqlite"
import { Database } from "bun:sqlite"

// session 表定义
export const sessionTable = sqliteTable("session", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  time_created: integer("time_created").notNull(),
  time_updated: integer("time_updated").notNull(),
})

// message 表定义
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

逐行解释：

- **`sqliteTable("session", { ... })`**：定义一张表，第一个参数 `"session"` 是数据库里的表名
- **`text("id")`**：定义一个 text 类型的列，列名是 `"id"`
- **`.primaryKey()`**：标记为主键（唯一标识一行）
- **`.notNull()`**：非空约束（不能为 null）
- **`integer("time_created")`**：定义一个 integer 类型的列

> 为什么写两次名字？`id: text("id")`——左边的 `id` 是 TS 代码里用的属性名，右边的 `text("id")` 是数据库里的列名。它们可以不同（比如 `timeCreated: text("time_created")`），但为了简单我们保持一致。

## 创建数据库

```ts
// 数据库文件路径
const DB_PATH = "opencode-from-scratch.db"

// 打开（或创建）数据库文件
const sqlite = new Database(DB_PATH)

// 开启 WAL 模式（提升并发读写性能）
sqlite.run("PRAGMA journal_mode = WAL")

// 用 Drizzle 包装
const db = drizzle(sqlite, { schema: { sessionTable, messageTable } })

// 创建表（如果不存在）
sqlite.run(`CREATE TABLE IF NOT EXISTS session (...)`)
sqlite.run(`CREATE TABLE IF NOT EXISTS message (...)`)
```

`CREATE TABLE IF NOT EXISTS` 表示"表不存在才创建"——程序多次启动不会报错（表已存在就跳过）。

> 对照 opencode：它用 Drizzle 的 migration 系统（`drizzle-kit`）管理表结构变更——类似 Python 的 Alembic。我们简化版直接 `CREATE TABLE IF NOT EXISTS`。

## 跑一下

看教学代码 `src/db-demo.ts`：

```bash
# 运行演示（创建数据库、插入 session、查询）
bun run src/db-demo.ts

# 用 sqlite3 命令行验证
sqlite3 opencode-from-scratch.db
.tables
SELECT * FROM session;
.quit
```

> 教学代码 `src/db-demo.ts` 已清理，可通过 git 历史查看。

## 对照 opencode

| | 我们的 | opencode 的 |
|---|--------|-------------|
| 表数量 | 2（session + message） | 6+（session、message、part、session_message 等） |
| session 字段 | 4 个 | 25+（cost、tokens、agent、model 等） |
| 消息存储 | 一行一条消息 | message + part 两表（拆成多个 part） |
| 表结构管理 | `CREATE TABLE IF NOT EXISTS` | Drizzle migration |
| 事件溯源 | 无 | 有（V2 用 event sourcing + projection） |

## 本课小结

1. **一对多关系**：一个 session 有多条 message
2. **外键**：message.session_id 指向 session.id
3. **JSON 字符串存储**：SQLite 没有 JSON 类型，tool_calls 序列化成 text 存
4. **Drizzle 定义表**：`sqliteTable` + `text` / `integer` + `.primaryKey()` / `.notNull()`
5. **CREATE TABLE IF NOT EXISTS**：程序多次启动不报错

下一步：[5.2 Session CRUD](../02-session-crud/01-session-crud.md) —— 创建、列表、加载 session。
