# 16.0.2 迁移总览：从两层到三层 monorepo

> 本课是整个阶段 16 的"地图"。先看清从哪里走到哪里、分几步走，
> 再进入每一课看具体操作。
>
> 还不清楚"领域服务化"是什么？先看 [16.0.1 什么是领域服务化](./01-what-is-domain-service.md)。

## 起点：两层 monorepo（阶段 15 结束时）

```
opencode-from-scratch/
├── packages/
│   ├── schema/           # 契约层：类型
│   └── opencode/         # 主应用：业务代码全在这里
│       └── src/
│           ├── agent-loop.ts        # agent 主循环
│           ├── index.ts             # CLI 入口
│           ├── tui/agent.tsx        # TUI 入口
│           ├── service/             # 已是 Service
│           │   ├── config.ts
│           │   ├── provider.ts
│           │   └── tool-registry.ts
│           ├── tool/                # 工具实现
│           ├── provider/            # Provider 实现
│           ├── db.ts                # 模块级单例 ← 问题
│           ├── session.ts           # 模块级函数 ← 问题
│           ├── message.ts           # 模块级函数 ← 问题
│           └── system-context.ts    # 模块级函数 ← 问题
```

**问题**：领域逻辑（db/session/message/system-context）散在模块级，
没有统一服务边界，无法替换实现（阶段 16.0.1 详述）。

## 终点：三层 monorepo（阶段 16 目标）

```
opencode-from-scratch/
├── packages/
│   ├── schema/           # 契约层：类型（不变）
│   ├── core/             # 领域服务层（本阶段新建）
│   │   └── src/
│   │       ├── config/          ConfigService
│   │       ├── provider/        ProviderService + 实现
│   │       ├── database/        Database 服务
│   │       ├── filesystem.ts    FileSystem 服务
│   │       ├── session/         SessionStore 服务
│   │       ├── tool/            ToolRegistry + 工具
│   │       ├── system-context.ts SystemContext 服务
│   │       └── error/           Typed Errors
│   └── opencode/         # 主应用（只留入口层）
│       └── src/
│           ├── agent-loop.ts     # agent 主循环（从 core 取服务）
│           ├── index.ts          # CLI（yield* core 服务）
│           └── tui/agent.tsx     # TUI（yield* core 服务）
```

## 分几步走？

```
第 1 步：建 core 包（纯搬移）
    新建 packages/core，把 service/tool/provider/db/session/message/system-context 全搬进去
    opencode 包只留入口层，import 改为 @opencode-from-scratch/core
    → typecheck 通过，功能不变（还是模块级，没服务化）

第 2 步：Database 服务
    db.ts（模块级单例）→ Database Service（Layer 里建库）
    → core/src/database/database.ts

第 3 步：Filesystem 服务
    新建 FileSystem Service 封装 read/write/glob/grep
    → core/src/filesystem.ts

第 4 步：Tool 注册表服务化
    工具 execute 改 Effect、从 Context 取 FileSystem
    ToolRegistry 升级为 register/list/get
    → core/src/tool/registry.ts

第 5 步：Session 存储服务
    session.ts + message.ts → SessionStore Service（依赖 Database）
    → core/src/session/store.ts

第 6 步：SystemContext 服务
    system-context.ts → SystemContext Service
    → core/src/system-context.ts

第 7 步：上层接入 + 验收
    CLI/TUI 改成 yield* core 服务，删除所有兼容层
    → typecheck 通过，CLI/TUI 跑通，功能与阶段 15 一致
```

## 每一步的验证标准

| 步骤 | 怎么确认成功了 |
|------|---------------|
| 第 1 步 | `bunx tsc --noEmit` 通过、CLI 跑通、git 显示 rename（历史保留） |
| 第 2 步 | `bun run core/src/database/database-demo.ts` 跑通（yield* Database.Service） |
| 第 3 步 | 工具走 FileSystem 服务后 CLI 的 read/glob 工具正常 |
| 第 4 步 | typecheck 通过、工具从 Context 取 FileSystem |
| 第 5 步 | CLI 会话恢复正常（走 SessionStore 服务） |
| 第 6 步 | typecheck 通过（SystemContext Service 成立） |
| 第 7 步 | typecheck 通过、CLI/TUI 跑通、无兼容层残留 |

## 一个关键工程决策：先搬移、后服务化

注意第 1 步**只搬不移逻辑**——把模块级文件原样搬进 core 包，typecheck 通过即可。
服务化从第 2 步才开始。

为什么先搬再改？
1. **搬移是纯工程量**（git mv 不改内容），风险最低，先落地
2. **服务化需要逐步理解**——每个服务一课，消化一个再下一个
3. 如果边搬边服务化，一次改太多，报错时不知道是搬错了还是服务化错了

这符合 AGENTS.md 的原则：渐进式复杂度，每步一个可验证的增量。

## 对照 opencode

| 我们 | opencode |
|------|----------|
| `packages/core`（领域服务） | `packages/core`（@opencode-ai/core，最大的领域包） |
| Database 服务 | `core/src/database/database.ts` |
| FileSystem 服务 | `core/src/filesystem.ts` |
| SessionStore 服务 | `core/src/session/store.ts` |
| ToolRegistry | `core/src/tool/registry.ts` |
| SystemContext | `core/src/system-context/` |

opencode 的 core 包有 50+ 文件，我们是它的简化版（只做我们需要的 6 个服务）。

## 下一步

[16.1 第 1 步：建 core 包](../01-core-package/01-move-to-core.md)
——动手把领域逻辑搬进 packages/core。
