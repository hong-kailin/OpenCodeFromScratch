# 16.0 总览：为什么需要"领域服务化"

> 阶段 16 的目标：把散在 opencode 包里的领域逻辑**搬进独立 core 包**，
> 并逐个升级成 Effect Service，产出 `packages/{schema, core, opencode}` 三层。
> 本课是地图，看完全貌后从 [16.1 建 core 包](../01-core-package/01-move-to-core.md) 动手。

## 阶段 15 结束时的问题

阶段 15 拆出了 schema 契约层，但**所有领域逻辑仍挤在 opencode 包**：
数据库单例（`db.ts`）、会话 CRUD（`session.ts`）、消息存取（`message.ts`）、
system prompt 组装（`system-context.ts`）都是**模块级函数/单例**。

模块级写法有硬伤（对照阶段 10-11 学过的 Service 思路）：

1. **import 即副作用**——`db.ts` 一被 import 就建库、建表，测试时无法换成内存库
2. **无法替换实现**——所有地方直接 `import { db }`，测文件读写没法 mock
3. **没有服务边界**——谁需要存储就从哪 import 函数，职责散落、没有统一出口

## 解法：三层 + 服务化

```
packages/
├── schema/    契约层（不变）
├── core/      领域层（本阶段新建 + 服务化）
└── opencode/  入口层（只剩 agent-loop + index + tui）
```

## 分 8 步走（每步一个可验证的增量）

| 步 | 内容 | 解决的问题 |
|----|------|-----------|
| 16.1 | 建 core 包（纯搬移） | 三层结构成立，逻辑不动 |
| 16.2 | Database 服务 | import 即建库 → provide 时才建库 |
| 16.3 | FileSystem 服务 | 文件操作散在各工具 → 收口成服务 |
| 16.4 | 工具 Effect 化 | execute 从 Promise → Effect，工具从 Context 取服务 |
| 16.5 | ToolRegistry 去中心化注册 | 集中工具列表 → 工具各自注册（opencode 模式） |
| 16.6 | SessionStore 服务 | session + message 合并成服务，依赖 Database |
| 16.7 | SystemContext 服务 | system prompt 组装服务化 |
| 16.8 | 上层接入 + 验收 | CLI/TUI 全走服务，删兼容层，功能与阶段 15 一致 |

## 设计原则

- **先搬移、后服务化**（16.1 只搬不改）——纯工程量先落地，服务化逐个理解
- **每步一个服务/概念**——不把多件事塞进一课
- **每个简化版对照 opencode**——`core/src/` 就是它的真实结构，我们是简化版

## 对照 opencode

| 我们 | opencode |
|------|----------|
| `packages/core`（6 个服务） | `packages/core`（@opencode-ai/core，50+ 文件） |
| Database 服务（16.2） | `core/src/database/database.ts` |
| FileSystem 服务（16.3） | `core/src/filesystem.ts` |
| ToolRegistry（16.5） | `core/src/tool/registry.ts` |
| SessionStore（16.6） | `core/src/session/store.ts` |
| SystemContext（16.7） | `core/src/system-context/` |

## 下一步

[16.1 建 core 包](../01-core-package/01-move-to-core.md)——动手把领域逻辑搬进 packages/core。
