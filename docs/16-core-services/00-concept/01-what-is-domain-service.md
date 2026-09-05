# 16.0.1 什么是"领域服务化"（概念入门）

> 阶段 16 要把散落的领域逻辑重构成 Effect Service，搬进新建的 `core` 包。
> 本课先搞清楚两个问题：
> 1. 什么是"领域逻辑"？我们项目里哪些东西算领域逻辑？
> 2. 为什么要把它们"服务化"？模块级函数/单例有什么不好？

## 先看看阶段 15 结束时的代码长什么样

阶段 15 之后，我们的项目是两层 monorepo：

```
opencode-from-scratch/
├── packages/
│   ├── schema/           # 契约层：只定义类型（Message、ToolCall...）
│   └── opencode/         # 主应用：业务代码全在这里
│       └── src/
│           ├── agent-loop.ts         # agent 主循环
│           ├── index.ts              # CLI 入口
│           ├── tui/agent.tsx         # TUI 入口
│           ├── service/              # 已是 Service（阶段 11-12 做的）
│           │   ├── config.ts         #   ConfigService
│           │   ├── provider.ts       #   ProviderService
│           │   └── tool-registry.ts  #   ToolRegistry
│           ├── tool/                 # 工具实现（read/write/edit/bash/glob/grep）
│           ├── provider/             # Provider 实现（openai/anthropic）
│           ├── db.ts                 # ← 数据库初始化（模块级单例）
│           ├── session.ts            # ← Session CRUD（模块级函数）
│           ├── message.ts            # ← Message 存储（模块级函数）
│           └── system-context.ts     # ← 组装 system prompt（模块级函数）
```

注意标注 ← 的四个文件：**它们还是"模块级"代码**，不是 Service。
这是阶段 16 要解决的核心问题。

## 什么是"领域逻辑"？

**领域逻辑（domain logic）** = 一个应用"业务上必须做的事"，区别于"界面怎么显示"、
"命令怎么解析"这类外围代码。

对照我们项目：

| 领域逻辑 | 做的事 | 对应 opencode 的位置 |
|----------|--------|---------------------|
| **数据库** | 建 SQLite、建表、提供查询连接 | `core/src/database/` |
| **文件系统** | 读文件、写文件、glob、grep | `core/src/filesystem.ts` |
| **工具注册表** | 工具的注册与查找 | `core/src/tool/registry.ts` |
| **会话存储** | 保存/加载对话历史 | `core/src/session/store.ts` |
| **System Context** | 组装 system prompt | `core/src/system-context/` |
| **Provider** | 封装 LLM 调用 | `llm/`（阶段 18 才拆） |

外围代码（不算领域逻辑）：
- `index.ts`：CLI 命令解析（yargs）—— 怎么"调用"agent
- `tui/agent.tsx`：界面渲染 —— 怎么"显示"结果
- `agent-loop.ts`：编排 —— 怎么把领域逻辑"串"起来

## 模块级函数/单例的问题（为什么服务化）

看 `db.ts` 的旧写法（阶段 5-15）：

```typescript
// 模块顶层就执行：import 这个文件的瞬间就建库！
const sqlite = new Database("opencode-from-scratch.db")
sqlite.run("PRAGMA journal_mode = WAL")
export const db = drizzle(sqlite, { schema: { sessionTable, messageTable } })
```

问题有三个：

**1. import 即建库（副作用不可控）**
只要任何代码 `import { db } from "./db"`，数据库就被创建。
- 你只是想引入一个类型，却触发了建库
- 测试时想用内存库（`:memory:`）？做不到——文件路径写死了

**2. 无法替换实现（不可 mock）**
所有地方都 `import { db }`——拿的是同一个单例。
- 测试想用假的数据库？得改 `db.ts` 源码
- opencode 的做法：消费方声明"我需要 Database"，测试时注入一个假实现

**3. 职责没有边界**
`session.ts`、`message.ts` 各自 import `db`，散落各处。
- "存储"这个能力没有归属，谁需要谁自己拿
- 想统计"所有用到存储的地方"？得全局搜 import

## 服务化的解法：Effect Service

阶段 11 已经学过 Service 三件套：

```
1. Interface   —— 声明"这个服务能做什么"（能力清单）
2. Service     —— tag（全局唯一标识，用 Context.Service 创建）
3. Layer       —— 提供实现（provide 时才真正构造，副作用收进 Layer）
```

服务化把上面三个问题全解决：

| 问题 | 服务化后的解法 |
|------|---------------|
| import 即建库 | 建库副作用收进 Layer，`provide` 时才执行 |
| 无法 mock | 消费方 `yield* Service`，测试时换一个 Layer 提供假实现 |
| 职责无边界 | 每个领域一个 Service，能力清单在 Interface 里显式声明 |

## 类比 Python

| 概念 | Python 对照 | 我们（TS + Effect） |
|------|------------|---------------------|
| 模块级单例（db.ts） | 模块级 `_db = sqlite3.connect(...)` | `export const db = ...` |
| 服务化 | FastAPI 的 `Depends(get_db)` 依赖注入 | `yield* Database.Service` |
| 可替换实现 | 测试时 monkeypatch / 注入假依赖 | 换一个 Layer 提供假实现 |
| 依赖关系 | `get_db` 被路由声明需要 | Layer 依赖 Layer（`yield*`） |

你在 Python 里应该体会过：全局单例难测试、难替换。服务化就是把
"谁需要什么依赖"显式声明出来，让框架（Effect 的 Context）在运行时注入。

## 阶段 16 的目标结构

把散落的领域逻辑收进新建的 `core` 包，变成三个层级：

```
packages/
├── schema/          契约层（类型）—— 不变
├── core/            领域服务层（本阶段新建）
│   └── src/
│       ├── config/          ConfigService（搬进来）
│       ├── provider/        ProviderService + Provider 实现（搬进来）
│       ├── database/        Database 服务（db.ts 服务化）
│       ├── filesystem.ts    FileSystem 服务（新建）
│       ├── session/         SessionStore 服务（session+message 服务化）
│       ├── tool/            ToolRegistry + 工具实现（搬进来）
│       ├── system-context.ts SystemContext 服务（新建）
│       └── error/           Typed Errors（搬进来）
└── opencode/        主应用（只留入口层：agent-loop + CLI + TUI）
```

关键变化：
- **core 包** = 所有领域逻辑，每个领域一个 Service
- **opencode 包** = 只留"入口层"（怎么调用、怎么显示），从 core 取服务
- 依赖方向：opencode → core → schema（单向，下层不知道上层）

## 小结

1. **领域逻辑** = 应用"业务上必须做的事"（数据库、文件系统、存储、system prompt）
2. **模块级单例/函数** 有三个问题：副作用不可控、不可 mock、职责无边界
3. **服务化** = 每个领域一个 Effect Service（Interface + Service + Layer）
4. **阶段 16** = 把散落逻辑搬进 core 包并服务化，opencode 只留入口层

## 下一步

[16.0.2 迁移总览](./02-overview.md) —— 看清阶段 16 分几步走。
