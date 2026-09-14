# 16.1 建 core 包：从两层到三层 monorepo

> 阶段 16 的完整地图见 [16.0 总览](../00-overview/01-overview.md)。
> 本课是第一步：**纯搬移，不改逻辑**。把散在 opencode 包里的领域逻辑
> 整体搬进新建的 `packages/core`，让三层结构先立起来。

## 起点：阶段 15 结束时的两层结构

```
packages/
├── schema/           # 契约层：类型（Effect Schema）
└── opencode/         # 主应用：业务代码全在这里
    └── src/
        ├── agent-loop.ts        # agent 主循环
        ├── index.ts             # CLI 入口
        ├── tui/agent.tsx        # TUI 入口
        ├── service/             # 服务（config / provider / tool-registry）
        ├── tool/                # 工具实现 + 工具接口
        ├── provider/            # Provider 实现
        ├── db.ts                # 数据库单例
        ├── session.ts           # session CRUD
        ├── message.ts           # message 存取
        ├── system-context.ts    # system prompt 组装
        ├── error/errors.ts      # 类型化错误
        └── debug.ts             # 调试工具
```

**问题**：所有"领域逻辑"（数据库、会话、文件操作、system prompt）和"入口逻辑"
（CLI、TUI、agent loop）混在同一个包的 src/ 里，没有分层边界。

对照 opencode 的真实结构，它把领域逻辑放在独立的 `core` 包里，主应用只管
怎么调用、怎么显示。我们也要拆出这一层。

## 终点：三层结构（本课目标）

```
packages/
├── schema/           # 契约层（不变）
├── core/             # 领域层（本课新建，逻辑原样搬入）
└── opencode/         # 入口层（只剩 agent-loop + index + tui）
```

## 为什么先"搬移"再"服务化"

阶段 16 的目标不只是搬文件，还要把模块级函数升级成 Effect Service。
但这两件事**必须拆开做**：

1. **搬移是纯工程量**（git mv 不改内容，风险最低）——先落地三层结构
2. **服务化需要逐个理解**——Database / FileSystem / SessionStore 各有各的门道，
   一节课消化一个（16.2 ~ 16.7）

如果边搬边服务化，一次改太多，报错时不知道是搬错了还是服务化错了。
这符合 AGENTS.md 的"渐进式复杂度"：每步一个可验证的增量。

## 操作 1：git mv 搬移领域文件

新建 core 包的目录骨架，然后用 `git mv`（不是 `mv`）搬文件。
`git mv` 会保留文件历史（git 识别为 rename 而不是 delete + add），
之后用 `git log --follow` 还能追溯每个文件的来历。

```bash
mkdir -p packages/core/src/{config,provider,tool,database,session,error}

# 服务（阶段 11-12 已做的 Service）
git mv packages/opencode/src/service/config.ts        packages/core/src/config/config.ts
git mv packages/opencode/src/service/provider.ts      packages/core/src/provider/provider.ts
git mv packages/opencode/src/service/tool-registry.ts packages/core/src/tool/registry.ts

# Provider 接口与实现
git mv packages/opencode/src/provider.ts              packages/core/src/provider/interface.ts
git mv packages/opencode/src/provider/openai.ts       packages/core/src/provider/openai.ts
git mv packages/opencode/src/provider/anthropic.ts    packages/core/src/provider/anthropic.ts

# 工具目录（.ts + .txt 描述文件一起搬）
git mv packages/opencode/src/tool/                    packages/core/src/tool/

# 领域逻辑（还是模块级函数，16.2 起逐个服务化）
git mv packages/opencode/src/db.ts                    packages/core/src/database/database.ts
git mv packages/opencode/src/session.ts               packages/core/src/session/session.ts
git mv packages/opencode/src/message.ts               packages/core/src/session/message.ts
git mv packages/opencode/src/system-context.ts        packages/core/src/system-context.ts

# 通用工具
git mv packages/opencode/src/debug.ts                 packages/core/src/debug.ts
git mv packages/opencode/src/error/errors.ts          packages/core/src/error/errors.ts
```

> **踩坑**：`git mv 目录 已存在的目录` 会把源目录**嵌套**进去。
> 上面的 `packages/core/src/tool/` 是操作 1 开头 mkdir 建好的，
> 所以 `git mv packages/opencode/src/tool/ packages/core/src/tool/`
> 会把文件移进 `packages/core/src/tool/tool/`。发现后用 git mv 逐个再移一层：
> ```bash
> git mv packages/core/src/tool/tool/*.ts  packages/core/src/tool/
> ```
> 排查方法：`find packages/core/src -type f` 看有没有多余的嵌套目录。

验证搬移结果是 rename 而不是 delete+add：

```bash
git status --short | grep -c "^R"     # 期望 26（都是 rename）
```

## 操作 2：建 core 包骨架（package.json + barrel）

`packages/core/package.json`：

```jsonc
{
  "name": "@opencode-from-scratch/core",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "dependencies": {
    "@opencode-from-scratch/schema": "workspace:*",
    "drizzle-orm": "^0.45.2",
    "effect": "^4.0.0-beta.97"
  }
}
```

core 需要 schema（用 Message/ToolCall 类型）、drizzle（数据库）、effect（Service 体系）。

`packages/core/src/index.ts`（barrel）——把包内所有公共 API 汇总到一处，
上层只需 `import { xxx } from "@opencode-from-scratch/core"`：

```typescript
// 服务（阶段 11-12 已做）
export { ConfigService, configLayer } from "./config/config"
export { ProviderService, providerLayer } from "./provider/provider"
export { ToolRegistry, toolRegistryLayer } from "./tool/registry"

// Provider 接口与实现
export type { Provider, ChatResult } from "./provider/interface"
export { createOpenAIProvider } from "./provider/openai"
export { createAnthropicProvider } from "./provider/anthropic"

// 工具
export type { Tool } from "./tool/tool"
export { toJSONSchema, toolToOpenAIFormat } from "./tool/tool"
export { readTool, writeTool, editTool, bashTool, globTool, grepTool } from "./tool/..."
export { truncate } from "./tool/truncate"

// 数据库与存储（模块级版本，16.2 起服务化）
export { db, sessionTable, messageTable } from "./database/database"
export { createSession, listSessions, getSession, updateSession } from "./session/session"
export { saveMessage, loadMessages } from "./session/message"

// System Context（模块级版本，16.7 服务化）
export { buildSystemPrompt } from "./system-context"

// 错误与调试
export { ConfigError, LLMError, ToolError } from "./error/errors"
export { debug, debugMessages } from "./debug"
```

> barrel 是"包的门面"：谁 import 这个包，就从这一个文件拿东西。
> 包内文件怎么组织、怎么改名，对外部透明——这就是"封装"的第一层。

## 操作 3：修 core 包内部的相对 import

文件位置变了，但相对 import 还指向旧路径。逐个修正（用 tsc 报错驱动，改一个验一个）：

| 文件 | 旧 import | 新 import |
|------|-----------|-----------|
| `session/session.ts` | `from "./db"` | `from "../database/database"` |
| `session/message.ts` | `from "./db"` | `from "../database/database"` |
| `tool/registry.ts` | `from "../tool/read"` 等 | `from "./read"` 等 |
| `provider/provider.ts` | `from "../provider/openai"` | `from "./openai"` |
| `provider/provider.ts` | `from "./config"` | `from "../config/config"` |
| `provider/openai.ts` | `from "../provider"` | `from "./interface"` |
| `provider/interface.ts` | `from "./tool/tool"` | `from "../tool/tool"` |
| `provider/anthropic.ts` | `from "../provider"` | `from "./interface"` |

> 注意 `tool/` 目录内的文件（read.ts 等）import `./tool`、`./xxx.txt`，
> 因为整个目录一起搬走，**内部相对关系不变，不用改**。

## 操作 4：opencode 包入口改 import + 配置

opencode 包剩下的入口文件（index.ts / agent-loop.ts / tui/agent.tsx）
从 `@opencode-from-scratch/core` 导入，不再依赖具体文件路径：

```typescript
// index.ts 里所有领域导入合并成一条
import {
  saveMessage, loadMessages, buildSystemPrompt,
  createSession, listSessions, getSession,
  debug, debugMessages, configLayer, providerLayer, toolRegistryLayer,
} from "@opencode-from-scratch/core"
```

配套三处配置：

```jsonc
// tsconfig.json 加 paths 别名
"paths": {
  "@opencode-from-scratch/core": ["./packages/core/src/index.ts"]
}

// opencode/package.json 加 workspace 依赖
"dependencies": { "@opencode-from-scratch/core": "workspace:*" }
```

顺手删掉 `packages/opencode/src/llm.ts`——阶段 6 的旧代码，早被 ConfigService
取代，无引用（`rg "llm" packages/opencode/src` 无结果）。

## 操作 5：修 bunfig preload（动手才发现的环境问题）

`bun run packages/opencode/src/index.ts` 一跑就报：

```
error: preload not found "./packages/opencode/node_modules/@opentui/solid/scripts/preload.js"
```

这是阶段 15 搬主应用时留下的 bug：`bunfig.toml` 的 preload 路径指向了不存在的
子包 node_modules。排查过程（教 debug）：

1. `ls packages/opencode/node_modules/@opentui/solid/scripts/preload.js`
   → 报 No such file。但 `bun install` 后 @opentui 应该装在这……
2. `ls node_modules/@opentui/` → 根目录也没有！
3. 用 `find node_modules -name package.json -path "*opentui*"` 全盘找
   → 发现 @opentui 装在 `node_modules/.bun/...`（bun 的内容寻址缓存）
4. 意识到：**bun 把"只被 opencode 依赖"的 @opentui 放进了子包**
   `packages/opencode/node_modules`，而不是根目录
5. 重新 `ls packages/opencode/node_modules/@opentui/solid/scripts/preload.js` → 存在！
   之前找不到是因为我 install 前看的是旧布局

> 结论：bun 的依赖布局取决于安装时的依赖图。@opentui/solid 只被 opencode
> 依赖，bun install 时它装进子包。所以 preload 必须写成**从根目录出发的
> 相对路径**指向子包真实位置，不能指向根 node_modules。
> 还试过包名形式 `preload = ["@opentui/solid/preload"]`——bun 的 preload
> 不支持包名 exports 子路径，只认相对路径（实验验证）。

最终 bunfig.toml：

```toml
preload = ["./packages/opencode/node_modules/@opentui/solid/scripts/preload.js"]
```

## 验证：第 1 步成功标志

```bash
bun install                       # 让 workspace 链接新包
bunx tsc --noEmit                 # 通过
git status --short | grep -c "^R" # 26 个 rename
bun run packages/opencode/src/index.ts --help        # CLI 能启动
bun run packages/opencode/src/index.ts run "1+1=?"   # 完整链路跑通
```

## 对照 opencode

| 我们 | opencode |
|------|----------|
| `packages/core`（领域层） | `packages/core`（@opencode-ai/core，最大的领域包） |
| core 的 barrel `index.ts` | `core/src/index.ts` 导出全部领域 API |
| opencode 包只留入口 | `packages/opencode` 只做 CLI/agent 编排 |

opencode 的 core 包有 50+ 文件，我们是它的简化版——先搬入已有的
config/provider/tool/database/session/message/system-context/error/debug。

## 小结

第 1 步做完，三层结构成立：
- **schema** 契约层（类型）
- **core** 领域层（逻辑，还是模块级——服务化从 16.2 开始）
- **opencode** 入口层（怎么调用、怎么显示）

纯搬移，逻辑一行没改。下一步把 `db.ts` 升级成 Database Service。

## 下一步

[16.2 Database 服务](../02-database/01-database-service.md)
——把"import 即建库"的模块级单例改成"provide 时才建库"的 Effect Service。
