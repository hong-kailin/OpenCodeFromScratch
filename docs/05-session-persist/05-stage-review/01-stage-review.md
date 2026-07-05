# 5.5 阶段验收：持久化 agent + 工程思维总结

> 本课目标：验收阶段 5 的成果，总结工程思维，对照 opencode 看差距。

## 验收清单

```bash
# 1. 类型检查通过
bun run typecheck

# 2. 完整流程测试
bun run src/index.ts
# 第一次运行：
#   → 自动新建 session
#   → 输入 "你好" → AI 回复
#   → Ctrl+C 退出

# 第二次运行：
#   → 列出已有 session
#   → 选择恢复 [0]
#   → 输入 "我刚才说了什么？" → AI 能回答 "你说了你好"
```

| 验收项 | 状态 |
|--------|------|
| SQLite 数据库搭建（db.ts） | ✓ |
| Drizzle ORM 表定义（session + message） | ✓ |
| Session CRUD（create / list / get / update） | ✓ |
| Session ID 生成（时间戳 + 随机） | ✓ |
| Message 存储（saveMessage / loadMessages） | ✓ |
| JSON 序列化（tool_calls ↔ JSON 字符串） | ✓ |
| 启动选择（新建 / 恢复） | ✓ |
| 对话中自动保存 | ✓ |
| 重启后恢复历史 | ✓ |
| 调试模式兼容（DEBUG_INPUTS） | ✓ |

## 项目结构

阶段 5 新增/修改的代码：

```
src/
├── index.ts          # 修改：启动选择 + 自动保存
├── db.ts             # 新增：SQLite + Drizzle 初始化 + 表定义
├── session.ts        # 新增：Session CRUD（create/list/get/update）
├── message.ts        # 新增：Message 存储（save/load + JSON 序列化）
└── types.ts          # 未改（Message 类型阶段 3 已定义）
```

## 对照 opencode：直接 CRUD vs 事件溯源

我们的持久化：**直接 CRUD**——要存什么就 INSERT，要读什么就 SELECT。

```ts
// 直接写数据库
await db.insert(messageTable).values(row)

// 直接读数据库
const rows = await db.select().from(messageTable).where(...)
```

opencode 的持久化：**事件溯源 + 投影**——业务代码只发事件，projector 订阅事件写库。

```ts
// 业务代码：只发事件，不写库
yield* events.publish(SessionV1.Event.MessageUpdated, { sessionID, info })

// projector：订阅事件，写库（另一个文件里）
yield* events.project(SessionV1.Event.MessageUpdated, (event) => {
  yield* db.insert(MessageTable).values(...).onConflictDoUpdate(...)
})
```

### 差距对比

| | 我们的 | opencode 的 | 为什么 opencode 更复杂 |
|---|--------|-------------|----------------------|
| 写入方式 | 直接 INSERT | publish 事件 → projector 异步写 | 解耦、可重放 |
| 消息模型 | 单表（一行一条消息） | 两表（message 容器 + part 内容片段） | 流式更新、独立生命周期 |
| Session 字段 | 4 个（id/title/created/updated） | 25+（cost/tokens/model/metadata/...） | 计费、上下文管理、多 agent |
| ID 生成 | 时间戳 + 随机 | 降序 ULID（按位取反） | ORDER BY id 自动倒序 |
| Session 层级 | 扁平 | project → workspace → parent/child | 多项目、子任务 |
| 读模型 | 直接查表 | 可以建多个投影 | 不同视图不同查询需求 |

## 工程思维总结

### 1. 什么时候该用事件溯源

事件溯源不是"更高级"的方案，是**为特定需求服务的**。用它之前先问：你有这些需求吗？

| 需求 | 直接 CRUD 够用吗 | 事件溯源的价值 |
|------|-----------------|---------------|
| 存数据、读数据 | ✓ 够用 | 没有额外价值 |
| 审计日志（谁在什么时候做了什么） | 手动加 log 表 | 天然支持（事件就是日志） |
| 状态回滚（回到某个时间点） | 很难 | 事件重放到指定时间点即可 |
| 多个读视图（同一份数据不同视角查） | 每个视图手写查询 | 一个投影一个读模型 |
| 跨服务通信（其他服务关心数据变更） | 轮询或 webhook | 订阅事件流 |

opencode 用事件溯源因为：
- TUI 需要实时更新（订阅事件，不用轮询数据库）
- session 可以回滚到之前的状态
- 消息的 part 有独立生命周期（pending → running → completed 各发一次事件）

> **工程思维**：不要因为"更高级"就用某个方案。先问"我的需求是什么"，再选方案。我们的 agent 现在只需要存取数据，直接 CRUD 够用。等需要 TUI 实时更新或状态回滚时，再引入事件溯源。

### 2. 先简单后演进

阶段 5 的每个设计都是"简化版 → 对照 opencode → 知道什么时候该补全"：

| 简化版 | opencode 版 | 什么时候补全 |
|--------|-------------|-------------|
| 单表存消息 | message + part 两表 | 需要 part 独立更新时（流式、状态变化） |
| 时间戳 ID | 降序 ULID | 性能瓶颈在 ORDER BY 时 |
| 4 字段 session | 25+ 字段 | 需要计费、token 统计、多 agent 时 |
| 直接 CRUD | 事件溯源 + 投影 | 需要 TUI 实时更新、状态回滚时 |

每个简化都是**有意识的 trade-off**——知道少了什么、什么时候要补，而不是"不知道还能这样做"。

### 3. JSON 序列化：简单方案的边界

我们把 `tool_calls` 存成 JSON 字符串——简单直接，但有个代价：
- 不能在 SQL 里查单个 tool_call（比如"这个 session 调了哪些工具"）
- 更新一个 tool_call 的状态要读出整个 JSON、改、写回
- 没有运行时类型验证（`JSON.parse` 返回 `any`）

opencode 把每个 tool_call 拆成独立的 part 行——可以单独查、单独更新、有类型安全。代价是复杂度高（两表 JOIN、part 类型判别）。

> **工程思维**：简单方案的边界在哪？什么时候不够用？这是比"用更复杂的方案"更重要的判断力。

## 阶段 5 学了什么

| 课 | 知识点 |
|----|--------|
| 5.1 | SQLite 基础（CRUD SQL）、Drizzle ORM（表定义、链式查询）、表设计（session + message） |
| 5.2 | Drizzle CRUD 四件套、Session ID 生成、对照 opencode 的降序 ULID |
| 5.3 | JSON 序列化（对象 ↔ TEXT 字段）、Message 存储、对照 opencode 的两表设计 |
| 5.4 | 启动选择（新建/恢复）、自动保存、system prompt 不存库、调试模式兼容 |

你现在是"能持久化的 agent"——重启后能恢复之前的对话。下一步是 Provider 抽象——让 agent 支持多个 LLM provider，可切换。

---

下一步：[阶段 6：Provider 抽象](../../06-provider/) —— 从硬编码 OpenAI 抽象出 Provider 接口，接入 Anthropic。
