# 5.2 Session ID 生成：为什么不是简单的自增数字

> 本课目标：理解 ID 生成的设计考量，实现一个简化版的 session ID 生成器，对照 opencode 的精妙设计。

## 为什么 ID 这么重要

每条数据需要一个**唯一标识**（ID），用来区分。你可能觉得这很简单——`1, 2, 3...` 自增不就行了？

但现实没这么简单。考虑这些场景：

1. **分布式**：两个进程同时创建 session，都自增到 `5`，ID 冲突了
2. **排序**：你想按时间列出 session，但自增 ID 只能告诉你创建顺序，不能直接排序（如果 ID 本身就按时间排好序呢？）
3. **可读性**：`session-1700000000` 比 `session-42` 更容易知道是什么时候创建的
4. **不可猜测**：用户不想让别人通过 `session-1`、`session-2` 猜出有多少会话

## 常见 ID 方案对比

| 方案 | 例子 | 优点 | 缺点 |
|------|------|------|------|
| 自增整数 | `1, 2, 3` | 简单 | 分布式冲突、可猜测 |
| UUID v4 | `550e8400-e29b-41d4-a716-446655440000` | 全局唯一、不可猜测 | 完全随机，无法排序 |
| ULID | `01H8X3KJRM9XWJ5Q3N1Z8B2Y4T` | 按时间排序、唯一 | 需要额外库 |
| 时间戳 + 随机 | `ses_1700000000_a3b2c1` | 简单、可排序 | 理论上可能冲突 |

> Python 类比：Python 里最常见的是 `uuid.uuid4()` 生成 UUID。Django 的 ORM 默认用自增整数，也可以配置 UUID。

## 我们的简化方案

用一个简单但够用的方案：**前缀 + 时间戳 + 随机后缀**

```
ses_<13位时间戳>_<6位随机>
例如: ses_1700000000000_a3b2c1
```

```ts
function generateSessionId(): string {
  const timestamp = Date.now()              // 13 位毫秒时间戳
  const random = Math.random().toString(36).slice(2, 8)  // 6 位随机字符串
  return `ses_${timestamp}_${random}`
}
```

为什么这样设计：
- **`ses_` 前缀**：一眼看出这是 session ID（opencode 也用 `ses_` 前缀）
- **时间戳**：按时间排序，不会冲突（同一毫秒内由随机后缀区分）
- **随机后缀**：防猜测，防同毫秒冲突

> `Math.random().toString(36)` 是什么？`toString(36)` 把数字转成 36 进制（0-9 + a-z），比 16 进制更短。

## 对照 opencode：精妙的降序 ULID

opencode 的 ID 生成远比我们的复杂，而且设计得很巧妙。看看它怎么做的。

### opencode 的 ID 格式

```
ses_<26位字符>
例如: ses_01j4ka3m2n5xw7j5q3n1z8b2y4
```

去掉 `ses_` 前缀后，是一个 26 位的字符串。这个字符串有特殊性质：**字典序排序 = 时间倒序**。

### 怎么做到的

opencode 的 ID 生成在 `packages/schema/src/identifier.ts`：

```ts
const length = 26
const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"

export function create(descending: boolean, timestamp = Date.now()) {
  // 1. 时间戳 + 计数器（同一毫秒内自增）
  counter++
  const current = BigInt(timestamp) * 0x1000n + BigInt(counter)

  // 2. 降序模式：按位取反
  const value = descending ? ~current : current

  // 3. 时间部分编码成 12 位十六进制
  const time = Array.from({ length: 6 }, (_, index) =>
    Number((value >> BigInt(40 - 8 * index)) & 0xffn).toString(16).padStart(2, "0"),
  ).join("")

  // 4. 随机部分 14 位
  const bytes = crypto.getRandomValues(new Uint8Array(length - 12))
  return time + Array.from(bytes, (byte) => chars[byte % 62]).join("")
}
```

### 为什么这么设计

关键在 `descending ? ~current : current` 这行——**按位取反**。

普通的时间戳 ID（比如 ULID）是**升序**的：越新的 ID 字典序越大。要按时间倒序列出 session，你得 `ORDER BY time_created DESC`。

opencode 做了一个聪明的事：把时间戳按位取反，这样**越新的 ID 字典序越小**。于是：

```sql
-- 最新的 session 排在最前面，不需要 ORDER BY time_created
SELECT * FROM session ORDER BY id ASC LIMIT 10
```

数据库的主键索引本身就按 id 排序，所以 `ORDER BY id` 是免费的（不用额外排序）。这让"列出最近 session"这个高频操作变得极快。

> **工程思维**：这是一个典型的"为读优化"的设计。创建 session 时多做一点计算（取反），换来读取时不需要额外排序。在数据库设计里，这种"用空间/写入复杂度换查询速度"的 trade-off 非常常见。

### 我们的简化版 vs opencode

| | 我们的方案 | opencode |
|---|-----------|----------|
| 格式 | `ses_1700000000000_a3b2c1` | `ses_01j4ka3m2n5xw7j5q3n1z8b2y4` |
| 排序 | 需要额外 `ORDER BY time_created` | `ORDER BY id` 就是时间倒序 |
| 冲突概率 | 同毫秒 + 同随机才冲突 | 有计数器，同毫秒不冲突 |
| 可读性 | 时间戳可读 | 不可读 |
| 复杂度 | 3 行代码 | 30 行代码，用 BigInt 位运算 |

我们先用简单版，够用了。后续如果要 1:1 复刻 opencode，再换成它的 ID 方案。

## 本课小结

1. **ID 生成**不是小事——要考虑唯一性、排序、可读性、不可猜测性
2. **我们的方案**：`ses_时间戳_随机`，简单够用
3. **opencode 的方案**：降序 ULID，按位取反时间戳，让 `ORDER BY id` 自动按时间倒序
4. **工程思维**：为读优化——写入时多做一点，读取时省很多

下一步：[5.2 Session 模块实现](./03-session-module.md) —— 把 CRUD 和 ID 生成组装成 session 模块。
