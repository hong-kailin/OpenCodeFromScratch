# 5.1 SQLite：从零开始学数据库

> 本课目标：理解数据库是什么、学会基本 SQL 操作、能用 sqlite3 命令行和 Bun 代码操作 SQLite。

## 数据库是什么

你用过 Excel 吗？Excel 有多个**工作表**（Sheet），每个工作表是**行和列**组成的表格。

数据库就是这个概念——只不过用代码操作，不是用鼠标点。

```
数据库（像一个 Excel 文件）
├── 表 1: session（会话表）
│   ┌────────────┬─────────┬──────────────┐
│   │ id         │ title   │ time_created │  ← 列（column / 字段）
│   ├────────────┼─────────┼──────────────┤
│   │ session-1  │ 测试会话 │ 1700000000   │  ← 行（row / 一条数据）
│   │ session-2  │ 另一个   │ 1700000001   │
│   └────────────┴─────────┴──────────────┘
│
├── 表 2: message（消息表）
│   ┌──────┬────────────┬────────┬──────────┐
│   │ id   │ session_id │ role   │ content  │
│   ├──────┼────────────┼────────┼──────────┤
│   │ msg-1│ session-1  │ user   │ 你好      │
│   │ msg-2│ session-1  │assistant│ 你好！   │
│   └──────┴────────────┴────────┴──────────┘
│
└── 表 3: ...（可以有很多表）
```

| Excel 概念 | 数据库概念 |
|------------|-----------|
| Excel 文件 | 数据库（一个 .db 文件） |
| 工作表（Sheet） | 表（table） |
| 一行数据 | 一行记录（row / record） |
| 一列 | 一个字段（column / field） |
| 第一行（表头） | 表结构（schema） |

## SQL：和数据库对话的语言

SQL（Structured Query Language，结构化查询语言）是操作数据库的语言。你写 SQL 语句告诉数据库"帮我做什么"。

最基本的四个操作（CRUD）：

| 操作 | SQL | 做什么 | Python 类比 |
|------|-----|--------|-------------|
| **C**reate | `INSERT` | 插入一条数据 | `list.append()` |
| **R**ead | `SELECT` | 查询数据 | `for x in list: if ...` |
| **U**pdate | `UPDATE` | 修改数据 | `list[0].name = "new"` |
| **D**elete | `DELETE` | 删除数据 | `del list[0]` |

下面逐个学，每个都有实操。

## 实操：用 sqlite3 命令行学 SQL

macOS 自带 `sqlite3` 命令行工具。打开终端，跟着敲：

### 创建数据库和表

```bash
# 创建一个练习用的数据库文件（文件不存在会自动创建）
sqlite3 test.db
```

进入 sqlite3 交互界面后（提示符是 `sqlite>`），创建一张表：

```sql
-- 创建 users 表
-- 语法：CREATE TABLE 表名 (列名 类型 约束, ...)
CREATE TABLE users (
  id TEXT PRIMARY KEY,      -- TEXT 类型，主键（唯一标识）
  name TEXT NOT NULL,       -- TEXT 类型，不能为空
  age INTEGER               -- INTEGER 类型，可以为空
);
```

> SQL 语句以分号 `;` 结尾。忘了写分号会换行等待继续输入。

### 插入数据（INSERT）

```sql
-- 插入一条数据
-- 语法：INSERT INTO 表名 (列1, 列2, ...) VALUES (值1, 值2, ...)
INSERT INTO users (id, name, age) VALUES ('1', 'Alice', 30);
INSERT INTO users (id, name, age) VALUES ('2', 'Bob', 25);
INSERT INTO users (id, name, age) VALUES ('3', 'Charlie', 35);
```

> 字符串用**单引号**包裹：`'Alice'`。不是双引号。这是 SQL 的规则。

### 查询数据（SELECT）

```sql
-- 查询所有数据
-- 语法：SELECT 列 FROM 表名
SELECT * FROM users;
-- * 表示所有列。输出：
-- 1|Alice|30
-- 2|Bob|25
-- 3|Charlie|35

-- 只查特定列
SELECT name, age FROM users;
-- Alice|30
-- Bob|25
-- Charlie|35
```

### 条件查询（WHERE）

```sql
-- 查询 age 大于 28 的
-- 语法：SELECT ... FROM 表名 WHERE 条件
SELECT * FROM users WHERE age > 28;
-- 1|Alice|30
-- 3|Charlie|35

-- 查询 name 是 Alice 的
SELECT * FROM users WHERE name = 'Alice';
-- 1|Alice|30

-- 多个条件（AND / OR）
SELECT * FROM users WHERE age > 25 AND age < 35;
-- 1|Alice|30
```

> Python 类比：`[u for u in users if u.age > 28]`，SQL 的 WHERE 就是列表推导的 if 条件。

### 修改数据（UPDATE）

```sql
-- 修改 Bob 的年龄
-- 语法：UPDATE 表名 SET 列=值 WHERE 条件
UPDATE users SET age = 26 WHERE name = 'Bob';

-- 验证
SELECT * FROM users WHERE name = 'Bob';
-- 2|Bob|26
```

> **UPDATE 一定要带 WHERE！** 不带 WHERE 会修改所有行：`UPDATE users SET age = 0` 会把所有人的年龄都改成 0。

### 删除数据（DELETE）

```sql
-- 删除 Charlie
-- 语法：DELETE FROM 表名 WHERE 条件
DELETE FROM users WHERE name = 'Charlie';

-- 验证
SELECT * FROM users;
-- 1|Alice|30
-- 2|Bob|26
```

> **DELETE 一定要带 WHERE！** 不带 WHERE 会删除所有数据：`DELETE FROM users` 清空整张表。

### 查看表结构

```sql
-- 查看表结构（有哪些列、什么类型）
.schema users
-- CREATE TABLE users (
--   id TEXT PRIMARY KEY,
--   name TEXT NOT NULL,
--   age INTEGER
-- );

-- 查看所有表
.tables
-- users
```

### 退出

```sql
.quit
```

> 试试现在就跟着敲一遍——实际操作是最好的学习方法。练完后可以 `rm test.db` 删掉练习文件。

## SQLite 的数据类型

SQLite 只有几种基本类型：

| 类型 | 存什么 | Python 类比 | 例子 |
|------|--------|-------------|------|
| `TEXT` | 文本 | `str` | `'Alice'`、`'你好'` |
| `INTEGER` | 整数 | `int` | `30`、`1700000000` |
| `REAL` | 浮点数 | `float` | `3.14` |
| `BLOB` | 二进制数据 | `bytes` | 图片、文件 |

**没有数组和对象类型。** 要存数组/对象，序列化成 JSON 字符串存到 TEXT 字段：

```sql
-- 存一个数组到 TEXT 字段
INSERT INTO messages (id, tool_calls) VALUES ('msg-1', '[{"id":"call_1","name":"read"}]');

-- 读出来后用代码 JSON.parse 还原
```

## Bun 里用 SQLite

Bun 内置了 `bun:sqlite`，不需要安装。两种用法：

### 方式 1：直接写 SQL

```ts
import { Database } from "bun:sqlite"

const sqlite = new Database("my-database.db")

// 执行 SQL（不返回结果，用于 CREATE / INSERT / UPDATE / DELETE）
sqlite.run("CREATE TABLE IF NOT EXISTS users (id TEXT, name TEXT)")
sqlite.run("INSERT INTO users VALUES ('1', 'Alice')")

// 查询（返回结果）
const rows = sqlite.query("SELECT * FROM users").all()
console.log(rows)  // [{ id: '1', name: 'Alice' }]

// 带参数的查询（防 SQL 注入）
const name = "Alice"
const rows2 = sqlite.query("SELECT * FROM users WHERE name = ?").all(name)
// ? 是占位符，Bun 自动安全地替换
```

> Python 类比：
> ```python
> import sqlite3
> conn = sqlite3.connect("my-database.db")
> conn.execute("CREATE TABLE ...")
> conn.execute("INSERT INTO ...")
> rows = conn.execute("SELECT * FROM users").fetchall()
> ```

### 方式 2：用 ORM（Drizzle）

直接写 SQL 的问题：没有类型安全、容易 SQL 注入、不好维护。下一课学 Drizzle ORM 解决这些问题。

## sqlite3 命令行技巧

```bash
# 打开数据库
sqlite3 opencode-from-scratch.db

# 常用命令（在 sqlite> 提示符里）
.tables              # 列出所有表
.schema 表名         # 查看表结构
SELECT * FROM 表名;  # 查询数据
SELECT * FROM 表名 LIMIT 5;  # 只看前 5 行

# 让输出更好看
.mode column         # 列对齐模式
.headers on          # 显示列名
SELECT * FROM users;
-- id  name   age
-- --  -----  ---
-- 1   Alice  30
-- 2   Bob    26

# 退出
.quit
```

> `.mode column` 和 `.headers on` 让输出像表格一样，很好用。每次打开 sqlite3 都可以先设这两个。

## 本课小结

1. **数据库** = Excel 文件，**表** = 工作表，**行** = 一条数据，**列** = 一个字段
2. **SQL** = 操作数据库的语言，四个基本操作：INSERT（插）、SELECT（查）、UPDATE（改）、DELETE（删）
3. **WHERE** = 查询条件，类似 Python 列表推导的 if
4. **字符串用单引号**：`'Alice'`，不是双引号
5. **UPDATE/DELETE 一定要带 WHERE**，否则会修改/删除所有数据
6. **TEXT 存 JSON**：SQLite 没有数组类型，序列化成字符串存
7. **sqlite3 命令行**：`.tables`、`.schema`、`.mode column`、`.headers on`

下一步：[5.1 ORM 与 Drizzle](./03-drizzle-orm.md) —— 用代码操作数据库，不用手写 SQL。
