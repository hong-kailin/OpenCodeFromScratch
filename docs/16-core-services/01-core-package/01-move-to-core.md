# 16.1 第 1 步：建 core 包——把领域逻辑搬进 packages/core

> 对照代码：`packages/core/`（新建）、`packages/opencode/src/`（瘦身后只剩入口层）

## 这一步做什么

第 15 阶段的 monorepo 只有两层（schema + opencode），所有领域逻辑都挤在
opencode 包的 src/ 里。这步把领域逻辑（config/provider/tool/database/session/
message/system-context/error/debug）全部搬进新建的 `packages/core`，形成三层结构。

**关键：这一步是纯搬移，不改任何逻辑**——文件原样搬过去，只改 import 路径。
服务化从第 2 步（16.2）才开始。

## 为什么先"搬移"再"服务化"

拆开做有两个好处：
1. **搬移是纯工程量**（git mv 不改内容），风险最低——先落地三层结构
2. **服务化需要逐个理解**——Database/Filesystem/SessionStore 各有各的门道，
   一节课消化一个

如果边搬边服务化，一次改太多，报错时不知道是搬错了还是服务化错了。
这符合"渐进式复杂度"：每步一个可验证的增量。

## 操作 1：建 core 包骨架

```bash
mkdir packages/core
mkdir packages/core/src/{config,provider,tool,database,session,error}
```

`packages/core/package.json`（依赖 schema + drizzle + effect）：

```jsonc
{
  "name": "@opencode-from-scratch/core",   // 领域包名
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },    // 入口是 barrel（index.ts）
  "dependencies": {
    "@opencode-from-scratch/schema": "workspace:*",
    "drizzle-orm": "^0.45.2",
    "effect": "^4.0.0-beta.97"
  }
}
```

## 操作 2：git mv 搬移领域文件

用 `git mv`（不是 `mv`）——保留文件历史（阶段 15 讲过 rename 的好处）：

```bash
# 服务（阶段 11-12 已做的 Service）
git mv packages/opencode/src/service/config.ts        packages/core/src/config/config.ts
git mv packages/opencode/src/service/provider.ts      packages/core/src/provider/provider.ts
git mv packages/opencode/src/service/tool-registry.ts packages/core/src/tool/registry.ts

# Provider 接口与实现
git mv packages/opencode/src/provider.ts              packages/core/src/provider/interface.ts
git mv packages/opencode/src/provider/openai.ts       packages/core/src/provider/openai.ts
git mv packages/opencode/src/provider/anthropic.ts    packages/core/src/provider/anthropic.ts

# 工具（.ts + .txt）
git mv packages/opencode/src/tool/                    packages/core/src/tool/

# 领域逻辑（还是模块级，第 2-6 步逐步服务化）
git mv packages/opencode/src/db.ts                    packages/core/src/database/database.ts
git mv packages/opencode/src/session.ts               packages/core/src/session/session.ts
git mv packages/opencode/src/message.ts               packages/core/src/session/message.ts
git mv packages/opencode/src/system-context.ts        packages/core/src/system-context.ts

# 通用
git mv packages/opencode/src/debug.ts                 packages/core/src/debug.ts
git mv packages/opencode/src/error/errors.ts          packages/core/src/error/errors.ts
```

验证搬移：

```bash
git status     # 26 个文件都显示 R（rename），不是 D+A
```

## 操作 3：建 core 包的 barrel（index.ts）

core 包需要 `index.ts` 汇总所有公共 API，上层才能 `import { xxx } from "@opencode-from-scratch/core"`：

```typescript
// packages/core/src/index.ts
export { ConfigService, configLayer } from "./config/config"
export { ProviderService, providerLayer } from "./provider/provider"
export { ToolRegistry, toolRegistryLayer } from "./tool/registry"
export { createOpenAIProvider } from "./provider/openai"
export { readTool, writeTool, editTool, bashTool, globTool, grepTool } from "./tool/..."
export { db, sessionTable, messageTable } from "./database/database"
export { createSession, listSessions, getSession, updateSession } from "./session/session"
export { saveMessage, loadMessages } from "./session/message"
export { buildSystemPrompt } from "./system-context"
export { ConfigError, LLMError, ToolError } from "./error/errors"
export { debug, debugMessages } from "./debug"
```

## 操作 4：修 core 包内部的相对 import

搬移后文件位置变了，相对 import 要改。例如：
- `provider/provider.ts`（原 service/provider.ts）：`from "./config"` → `from "../config/config"`
- `tool/registry.ts`（原 service/tool-registry.ts）：`from "../tool/read"` → `from "./read"`
- `session/session.ts`：`from "./db"` → `from "../database/database"`

## 操作 5：opencode 包改 import + tsconfig paths

opencode 包剩下的入口文件（index.ts / agent-loop.ts / tui/agent.tsx）改为从
`@opencode-from-scratch/core` 导入。同时删掉遗留的 llm.ts（阶段 6 的旧代码，
已被 ConfigService 取代，无引用）：

```bash
git rm packages/opencode/src/llm.ts
```

tsconfig.json 加 paths：

```jsonc
"paths": {
  "@/*": ["./packages/opencode/src/*"],
  "@opencode-from-scratch/schema": ["./packages/schema/src/index.ts"],
  "@opencode-from-scratch/core": ["./packages/core/src/index.ts"]   // 新增
}
```

opencode/package.json 加 core 依赖：`"@opencode-from-scratch/core": "workspace:*"`。

## 操作 6：bun install + typecheck + 跑通

```bash
bun install
bunx tsc --noEmit
bun run packages/opencode/src/index.ts run "你好"   # 功能不变
```

## 验证：第 1 步成功标志

```bash
bunx tsc --noEmit                          # 通过
git status                                 # 26 个 R（rename）
bun run packages/opencode/src/index.ts run "2+2?"   # CLI 跑通（2+2=4）
```

## 这一步后的结构

```
packages/
├── schema/          契约层
├── core/            领域逻辑（本步搬入，还是模块级）
└── opencode/        只剩入口层（agent-loop + index + tui + stream-demo）
```

opencode 包瘦身成功——从 30+ 文件减到 5 个入口文件。

## 小结

第 1 步做完，三层 monorepo 结构成立：
- **schema** 契约层（类型）
- **core** 领域层（逻辑，待服务化）
- **opencode** 入口层（怎么调用、怎么显示）

纯搬移，逻辑未变。下一步把 db.ts 服务化成 Database Service。

## 下一步

[16.2 第 2 步：Database 服务](../02-database/01-database-service.md)
——把模块级单例 db.ts 升级为 Effect Service。
