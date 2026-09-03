# 15.3 第 3 步：上层改用 schema 包

> 对照代码：`src/` 下 9 个文件的 import 改动、`src/service/config.ts`

## 这一步做什么

schema 包建好了，但上层代码还在从 `./types` / `../types` 导入。把 9 个文件的
导入改成 `@opencode-from-scratch/schema`，删除本地重复的 Config 定义，
最后删掉 `src/types.ts`。

## 操作 1：9 个文件换导入

涉及文件（9 个），改动模式相同：

| 文件 | 之前 | 之后 |
|------|------|------|
| `src/debug.ts` | `from "./types"` | `from "@opencode-from-scratch/schema"` |
| `src/agent-loop.ts` | `from "./types"` | 同上 |
| `src/index.ts` | `from "./types"` | 同上 |
| `src/message.ts` | `from "./types"` | 同上 |
| `src/provider.ts` | `from "./types"` | 同上 |
| `src/provider/anthropic.ts` | `from "../types"` | 同上 |
| `src/provider/openai.ts` | `from "../types"` | 同上 |
| `src/service/provider.ts` | `from "../types"` | 同上 |
| `src/tui/agent.tsx` | `from "../types"` | 同上 |

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

之前 `service/config.ts` 里有一个**本地重复定义**的 `interface Config`：

```typescript
// 之前（本地重复）
export interface Config {
  baseURL: string
  apiKey: string
  modelID: string
}
```

它和 `src/types.ts` 里的 `Config`（model/provider 结构）**同名但含义不同**——
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

## 操作 3：删除 src/types.ts

5 个类型全部搬进 schema 包后，`src/types.ts` 没内容了：

```bash
git rm src/types.ts
```

## 验证：第 3 步成功标志

```bash
bunx tsc --noEmit    # 通过（schema 包 + src 全项目类型无误）
```

此时 CLI 应该能跑（因为类型一样，只是来源变了）：

```bash
bun run src/index.ts run "你好"   # 注意：第 3 步时 src/ 还在根目录
```

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

第 3 步做完，契约层被上层使用了：9 个文件从 schema 包导入，本地重复 Config
消除，`src/types.ts` 删除。typecheck 通过、功能不变。

## 下一步

[15.4 第 4 步：主应用 src → packages/opencode](../04-move-main-app/01-move-main-app.md)
——把业务代码整体搬进主应用包，形成真正的两层结构。
