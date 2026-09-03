# 15.2 第 2 步：建 schema 契约层

> 对照代码：`packages/schema/package.json`、`packages/schema/src/types.ts`、`packages/schema/src/index.ts`

## 这一步做什么

创建 `packages/schema` 包：把 5 个共享类型搬进来，用 Effect Schema 重写，
并配好包的导出（package.json + index.ts）。

## 为什么类型要搬进"契约层"

回顾单 package 时代的痛点（00-overview 提到）：
- `src/types.ts` 定义 ToolCall/Message 等共享类型
- 但 `service/config.ts` 里又**重复定义**了一个本地 `interface Config`——同名不同义
- 类型散落，没有统一归属

契约层的价值：**一份定义，多方共享**。Message 只定义一次，CLI、TUI、agent-loop
都用它；改类型只动 schema 包，上层知道去哪里找。

## 操作 1：写 packages/schema/package.json

```jsonc
// packages/schema/package.json
{
  "name": "@opencode-from-scratch/schema",  // 包名（@scope/name 格式）
  "private": true,                          // 不发布到 npm
  "type": "module",
  "exports": {
    ".": "./src/index.ts"                   // import 包名 → 这个文件
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "effect": "^4.0.0-beta.97"              // 只依赖 effect（叶子节点）
  },
  "devDependencies": {
    "@tsconfig/bun": "latest",
    "@types/bun": "latest"
  }
}
```

关键字段：
- `"name": "@opencode-from-scratch/schema"`：包名。`@scope/name` 是 scoped 命名
- `"exports": { ".": "./src/index.ts" }`：别人 `import { Message } from
  "@opencode-from-scratch/schema"` 时实际加载的文件
- `"dependencies": { "effect": ... }`：schema 包**只依赖 effect**——这是"叶子节点"
  的定义：不依赖任何业务代码

## 操作 2：写 packages/schema/src/types.ts（Effect Schema 重写）

把 `src/types.ts` 的 4 个类型 + `service/config.ts` 的 1 个重复类型搬进来，
全部升级为 Schema：

```typescript
// packages/schema/src/types.ts
import { Schema } from "effect"

// ── ToolCall：LLM 返回的工具调用 ──
export const ToolCall = Schema.Struct({
  id: Schema.String,
  type: Schema.Literal("function"),          // 只能等于 "function"
  function: Schema.Struct({
    name: Schema.String,
    arguments: Schema.String,
  }),
})
export type ToolCall = Schema.Schema.Type<typeof ToolCall>

// ── Message：一条对话消息 ──
export const Message = Schema.Struct({
  role: Schema.Literals(["system", "user", "assistant", "tool"]), // 联合字面量
  content: Schema.NullOr(Schema.String),     // string 或 null
  tool_calls: Schema.optional(Schema.Array(ToolCall)),
  tool_call_id: Schema.optional(Schema.String),
})
export type Message = Schema.Schema.Type<typeof Message>

// ── ProviderConfig：配置文件的 provider 结构 ──
export const ProviderConfig = Schema.Struct({
  name: Schema.String,
  baseURL: Schema.String,
  apiKey: Schema.String,
  models: Schema.Record(Schema.String, Schema.Unknown),
})
export type ProviderConfig = Schema.Schema.Type<typeof ProviderConfig>

// ── Config：配置文件结构 ──
export const Config = Schema.Struct({
  model: Schema.String,
  provider: Schema.Record(Schema.String, ProviderConfig),
})
export type Config = Schema.Schema.Type<typeof Config>

// ── ResolvedConfig：解析后的运行配置 ──
// 之前定义在 service/config.ts（本地 interface Config），搬进来并改名，
// 和上面的"配置文件结构 Config"区分开
export const ResolvedConfig = Schema.Struct({
  baseURL: Schema.String,
  apiKey: Schema.String,
  modelID: Schema.String,
})
export type ResolvedConfig = Schema.Schema.Type<typeof ResolvedConfig>
```

### 关键设计：值和类型同名

每个 schema 同时导出了**值**（`export const Message`）和**类型**（`export type Message`）。
TS 允许值和类型同名共存：

```typescript
export const Message = Schema.Struct({...})  // 值：运行期校验器
export type Message = Schema.Schema.Type<typeof Message>  // 类型：编译期
```

- `import { Message } from "@opencode-from-scratch/schema"` → 拿值（校验器）
- `import type { Message } from "@opencode-from-scratch/schema"` → 拿类型（标注用）

### 用到的 Schema 构造器（复习阶段 13 + 新增）

| 构造器 | 作用 | Python 类比 |
|--------|------|------------|
| `Schema.Struct({...})` | 定义对象形状 | `pydantic.BaseModel` |
| `Schema.Literal("x")` | 只能等于一个固定值 | `Literal["x"]` |
| `Schema.Literals(["a","b"])` | 只能取这几个值之一（**注意是复数，数组参数**） | `Literal["a","b"]` |
| `Schema.NullOr(Schema.String)` | string 或 null | `str \| None` |
| `Schema.optional(Schema.X)` | 可选字段 | 可选字段 |
| `Schema.Array(Schema.X)` | 数组 | `list[X]` |
| `Schema.Record(Schema.String, Schema.X)` | 键值对 | `dict[str, X]` |
| `Schema.Unknown` | 任意值 | `Any` |
| `Schema.Schema.Type<typeof X>` | 从 Schema 推导 TS 类型 | 类型推导 |

> ⚠️ 一个容易踩的坑：阶段 13 demo 里我们用过 `Schema.Literal("system", "user", ...)`
> （可变参数），但 beta.97 里 `Schema.Literal` 只接受**一个**参数（单值），
> 多值联合要用 `Schema.Literals(["a","b"])`（复数 + 数组）。写错会报
> "Expected 1 arguments, but got 4"。

## 操作 3：写 packages/schema/src/index.ts（barrel）

```typescript
// packages/schema/src/index.ts
export { ToolCall, Message, ProviderConfig, Config, ResolvedConfig } from "./types"
```

一行导出，同时导出值 + 类型（因为 types.ts 里同名共存）。

## 验证：第 2 步成功标志

```bash
bunx tsc --noEmit    # schema 包自身类型无误（先不管 src/ 还没改导入）
```

如果 schema 包有错误，`bunx tsc --noEmit` 会指向 `packages/schema/src/types.ts`。
此时 src/ 还有错误是正常的（第 3 步才改导入）。

## 对照 opencode

opencode 的 schema 包（`opencode/packages/schema/`）：
- 28 个领域 schema（Session、Message、ToolCall、Provider、Permission...）
- `src/index.ts` 是 barrel，一行导出一堆
- 只依赖 effect（`"effect": "catalog:"`）

我们用 5 个类型，结构完全一致，只是规模小。

## 小结

第 2 步做完，schema 契约层成立：5 个共享类型、Schema 重写、barrel 导出、
只依赖 effect。但上层代码还没用它——`src/` 里仍从 `./types` 导入。

## 下一步

[15.3 第 3 步：上层改用 schema 包](../03-import-switch/01-import-switch.md)
——9 个文件换导入，删除 src/types.ts。
