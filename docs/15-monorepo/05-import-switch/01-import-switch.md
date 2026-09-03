# 15.4 第 4 步：上层改用 schema 包

> 对照代码：`packages/opencode/src/` 下 9 个文件的 import 改动、`packages/opencode/src/service/config.ts`

## 这一步做什么

第 3 步把主应用搬进了 `packages/opencode/src/`，但代码还在从 `./types` / `../types`
导入（移动不改内容）。这步把 9 个文件的导入改成 `@opencode-from-scratch/schema`，
删除本地重复的 Config 定义，最后删掉 `packages/opencode/src/types.ts`。

> **注意**：此时代码在 `packages/opencode/src/`，不是根目录的 `src/`（第 3 步已搬走）。

## 操作 1：9 个文件换导入

涉及文件（9 个，都在 `packages/opencode/src/` 下），改动模式相同：

| 文件 | 之前 | 之后 |
|------|------|------|
| `packages/opencode/src/debug.ts` | `from "./types"` | `from "@opencode-from-scratch/schema"` |
| `packages/opencode/src/agent-loop.ts` | `from "./types"` | 同上 |
| `packages/opencode/src/index.ts` | `from "./types"` | 同上 |
| `packages/opencode/src/message.ts` | `from "./types"` | 同上 |
| `packages/opencode/src/provider.ts` | `from "./types"` | 同上 |
| `packages/opencode/src/provider/anthropic.ts` | `from "../types"` | 同上 |
| `packages/opencode/src/provider/openai.ts` | `from "../types"` | 同上 |
| `packages/opencode/src/service/provider.ts` | `from "../types"` | 同上 |
| `packages/opencode/src/tui/agent.tsx` | `from "../types"` | 同上 |

```typescript
// 之前
import type { Message, ToolCall } from "../types"

// 之后
import type { Message, ToolCall } from "@opencode-from-scratch/schema"
```

> ⚠️ 批量替换的坑：如果用 PowerShell 的 `Set-Content` 批量改，默认按 ANSI（GBK）
> 编码读写，会把 UTF-8 的中文注释搞坏（出现乱码、甚至报 "Unterminated string literal"、
> "File appears to be binary"）。**一定要用能正确按 UTF-8 处理的工具逐个改**
> （比如本项目的 edit 工具），改完用 `git diff` 确认每个文件只变了 import 那行，
> 中文注释完好。

## 操作 2：service/config.ts 消除重复 Config

之前 `packages/opencode/src/service/config.ts` 里有一个**本地重复定义**的
`interface Config`：

```typescript
// 之前（本地重复）
export interface Config {
  baseURL: string
  apiKey: string
  modelID: string
}
```

它和 `packages/opencode/src/types.ts` 里的 `Config`（model/provider 结构）**同名但含义不同**——
这是单 package 时代"类型重复、边界模糊"的活例子。现在：

```typescript
// 之后：删本地 Config，改用 schema 包的 ResolvedConfig
import type { ResolvedConfig } from "@opencode-from-scratch/schema"

export interface ConfigServiceApi {
  readonly get: () => Effect.Effect<ResolvedConfig>
}
// ...
const config: ResolvedConfig = { baseURL: provider.baseURL, apiKey: provider.apiKey, modelID }
```

为什么叫 `ResolvedConfig` 不叫 `Config`？
- schema 包的 `Config` = 配置文件原始结构 `{ model, provider }`（用户手写，未解析）
- `ResolvedConfig` = 解析后的运行配置 `{ baseURL, apiKey, modelID }`（程序真正用的）

改名是"被迫"的——搬进契约层后必须和已有的 `Config` 区分开，边界一下子清晰了。
这正是 monorepo 拆分的价值：**迫使你面对命名冲突，把隐含的边界显式化**。

## 操作 3：删除 types.ts

5 个类型全部搬进 schema 包后，`packages/opencode/src/types.ts` 没内容了：

```bash
git rm packages/opencode/src/types.ts
```

## 验证：第 4 步成功标志

```bash
bunx tsc --noEmit    # 通过（schema 包 + opencode 包全项目类型无误）
```

> ⚠️ 注意：此时**直接跑 CLI 还不能正常工作**——因为第 3 步搬主应用后 preload
> 就坏了（`@opentui/solid` 不在 root 的 node_modules 了），改导入不解决这个问题。
> typecheck 通过就说明第 4 步完成；要让 CLI/TUI 真正跑起来，是第 5 步修 preload 的事。

## 为什么"Schema 重写"比"只搬 interface"更好

如果只是把 interface 搬过去，`import type { Message }` 拿到的还是普通类型——
没有运行期校验。用 Schema 重写后：

```
一份定义（Schema.Struct）
    ├── 编译期类型：type Message = Schema.Schema.Type<typeof Message>
    └── 运行期校验器：Schema.decodeUnknownSync(Message)
```

阶段 19 的 server/client 边界校验会直接用这些 Schema。

## 小结

第 4 步做完，契约层被上层使用了：9 个文件从 schema 包导入，本地重复 Config
消除，`types.ts` 删除。typecheck 通过、功能不变。

## 下一步

[15.5 第 5 步：修 bunfig preload 坑](../06-preload-fix/01-preload-fix.md)
——让 CLI 和 TUI 能跑。
