# 5.2 Session 模块实现

> 本课目标：把前面学的 Drizzle CRUD 和 ID 生成组装成一个 `src/session.ts` 模块，提供 `createSession`、`listSessions`、`getSession` 三个函数。

## 模块设计

我们要创建 `src/session.ts`，导出三个函数：

```
createSession(title?)  → Session    创建新会话，返回 session 对象
listSessions()         → Session[]  列出所有会话（按时间倒序）
getSession(id)         → Session | undefined  按 ID 加载会话
```

`Session` 类型就是数据库行对应的对象：

```ts
interface Session {
  id: string
  title: string
  time_created: number
  time_updated: number
}
```

> Python 类比：这就像定义一个 dataclass，然后写三个函数操作它。

## 代码实现

代码在 `src/session.ts`，用 `bun run src/session-demo.ts` 跑演示。

关键点：
1. **`createSession`**：生成 ID → INSERT → 返回 session 对象
2. **`listSessions`**：SELECT + `orderBy(desc(time_updated))` → 返回数组
3. **`getSession`**：`where(eq(id))` + `.get()` → 返回单行或 undefined

对照 opencode 的 `session/session.ts`：
- opencode 的 `create` 用事件溯源（publish 事件 → projector 写库），我们直接 INSERT
- opencode 的 `list` 支持按 project、workspace、path、search 过滤，我们只查全部
- opencode 的 `get` 和我们的几乎一样：`where(eq(id)).get()`

## 运行演示

```bash
bun run src/session-demo.ts
```

会执行：
1. 创建 3 个 session
2. 列出所有 session（按时间倒序）
3. 按 ID 加载一个 session
4. 更新 session 标题
5. 再次列出验证更新

## 对照 opencode

| | 我们的实现 | opencode |
|---|-----------|----------|
| 创建 | 直接 `db.insert()` | `events.publish()` → projector 异步写库 |
| 列表 | `select().from().orderBy()` | 同样用 Drizzle，但加了很多 WHERE 过滤 |
| 加载 | `select().where(eq(id)).get()` | 几乎一样 |
| Session 对象 | 4 个字段的扁平对象 | 25+ 字段，嵌套 `tokens`、`time`、`summary` 等 |
| ID | `ses_时间戳_随机` | 降序 ULID，`ORDER BY id` 自动倒序 |

opencode 的 `fromRow` / `toRow` 函数做扁平 DB 行和嵌套领域对象之间的转换。我们简化版字段都是扁平的，不需要这层转换。后续阶段加更多字段时（cost、tokens、model 等），会引入类似的转换。

## 本课小结

1. **模块化**：把数据库操作封装成函数，外部不需要知道 SQL 细节
2. **三个核心操作**：create（INSERT）、list（SELECT + ORDER BY）、get（SELECT + WHERE + .get()）
3. **opencode 的区别**：事件溯源 vs 直接 CRUD——我们的简化版先跑起来，后续再演进

下一步：5.3 课——Message 存储，把对话消息存到数据库。
