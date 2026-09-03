# 15.2 Schema 契约层：把共享类型搬到 schema 包

> 对照代码：`packages/schema/src/types.ts`、`packages/schema/src/index.ts`

## 任务：把类型从 src/types.ts 搬进 schema 包

阶段 15.1 搭好了 monorepo 骨架（workspaces + paths）。现在把共享类型搬进去，
并用 Effect Schema 重写。

**之前**（`src/types.ts`）：interface 定义，只有编译期类型。
**现在**（`packages/schema/src/types.ts`）：Effect Schema 定义，双重身份。

## 搬什么：5 个类型

| 类型 | 说明 | 从哪来 |
|------|------|--------|
| `ToolCall` | LLM 返回的工具调用 | `src/types.ts` |
| `Message` | 一条对话消息 | `src/types.ts` |
| `ProviderConfig` | 配置文件的 provider 结构 | `src/types.ts` |
| `Config` | 配置文件结构 | `src/types.ts` |
| `ResolvedConfig` | 解析后的运行配置（baseURL/apiKey/modelID） | `src/service/config.ts`（原本是本地重复定义） |

注意最后一行：`ResolvedConfig` 之前定义在 `service/config.ts` 里（本地 `interface Config`），
和 `src/types.ts` 的 `Config` **不是同一个东西**——一个叫 Config 但含义不同，这正是
"类型重复定义、边界模糊"的实例。现在统一收进 schema 包，命名区分清楚。

## Effect Schema 重写：双重身份

每个类型从 `interface` 升级为 `Schema.Struct`，同时保留同名类型导出：

```typescript
// packages/schema/src/types.ts

// 值（运行期校验器）
export const Message = Schema.Struct({
  role: Schema.Literals(["system", "user", "assistant", "tool"]), // 联合字面量
  content: Schema.NullOr(Schema.String), // string 或 null
  tool_calls: Schema.optional(Schema.Array(ToolCall)), // 可选字段
  tool_call_id: Schema.optional(Schema.String),
})

// 类型（编译期用）——和值同名，TS 允许共存
export type Message = Schema.Schema.Type<typeof Message>
```

### 用到的 Schema 构造器

| 构造器 | 作用 | Python 类比 |
|--------|------|------------|
| `Schema.Struct({...})` | 定义对象形状 | `pydantic.BaseModel` |
| `Schema.Literals(["a","b"])` | 只能取这几个值之一（联合字面量） | `Literal["a","b"]` |
| `Schema.Literal("x")` | 只能等于一个固定值 | `Literal["x"]` |
| `Schema.NullOr(Schema.String)` | string 或 null | `str \| None` |
| `Schema.optional(Schema.X)` | 可选字段 | 可选字段 / default None |
| `Schema.Array(Schema.X)` | 数组 | `list[X]` |
| `Schema.Record(Schema.String, Schema.X)` | 键值对 | `dict[str, X]` |
| `Schema.Schema.Type<typeof X>` | 从 Schema 推导 TS 类型 | 类型推导 |

## index.ts：barrel 统一出口

```typescript
// packages/schema/src/index.ts
export { ToolCall, Message, ProviderConfig, Config, ResolvedConfig } from "./types"
```

一行导出，同时导出**值**（Schema 校验器）和**同名类型**（TS 类型）。
TS 允许值类型同名共存：`export const Message`（值）+ `export type Message`（类型）。
上层 `import { Message }` 拿值（用于校验），`import type { Message }` 拿类型（用于标注）。

## 上层改造：9 个文件换导入

所有从 `./types` / `../types` 导入的类型，改为从 schema 包导入：

```typescript
// 之前
import type { Message, ToolCall } from "../types"

// 现在
import type { Message, ToolCall } from "@opencode-from-scratch/schema"
```

涉及文件（9 个）：
- `src/` 根：`debug.ts`、`agent-loop.ts`、`index.ts`、`message.ts`、`provider.ts`
- `src/provider/`：`anthropic.ts`、`openai.ts`
- `src/service/`：`provider.ts`
- `src/tui/`：`agent.tsx`

另外 `src/service/config.ts`：删掉本地重复的 `interface Config`，改用 schema 包的
`ResolvedConfig`：

```typescript
// 之前（本地重复定义）
export interface Config { baseURL: string; apiKey: string; modelID: string }

// 现在（从 schema 包导入）
import type { ResolvedConfig } from "@opencode-from-scratch/schema"
```

## 收尾：删除 src/types.ts

类型全部搬走后，`src/types.ts` 没有内容了，删除它。

```
git rm src/types.ts
```

## 为什么"Schema 重写"比"只搬 interface"更好

如果只是把 interface 搬过去，`import type { Message }` 拿到的还是普通类型——
没有运行期校验。用 Schema 重写后：

```
一份定义（Schema.Struct）
    ├── 编译期类型：type Message = Schema.Schema.Type<typeof Message>
    └── 运行期校验器：Schema.decodeUnknownSync(Message)
```

这是阶段 13 学的"双重身份"，现在应用到了**所有共享类型**上。未来如果要对
API 边界的数据做校验（阶段 19 server/client），直接用这些 Schema 即可。

## 阶段 15.2 小结

1. 5 个共享类型搬进 schema 包，用 Effect Schema 重写（双重身份）
2. `index.ts` barrel 一行导出值 + 类型
3. 9 个文件换导入 + config.ts 消除重复定义
4. 删除 `src/types.ts`

## 下一步

[15.3 阶段验收](../03-review/01-review.md) —— typecheck + 跑通 + 工程思维。
