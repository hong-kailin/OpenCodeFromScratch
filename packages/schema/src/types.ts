// packages/schema/src/types.ts
// 共享契约层：所有 package 共用的类型定义（Effect Schema 重写）
//
// 阶段 15：从 src/types.ts 搬到这里，并升级为 Effect Schema。
// 之前：interface（只有编译期类型）
// 现在：Schema（双重身份——编译期是 TS 类型，运行期是校验器）
//
// 为什么把类型放这里（契约层）：
// - 这是 monorepo 的"叶子节点"，只依赖 effect，不依赖任何业务代码
// - 上层（src/）从这里导入，多个 package 共享同一份定义
// - 对照 opencode: packages/schema/src/ 的 28 个领域 schema

import { Schema } from "effect"

// ─────────────────────────────────────────────────────────────
// 工具调用（LLM 返回的，告诉你要调什么工具、传什么参数）
// ─────────────────────────────────────────────────────────────
// 之前：
//   export interface ToolCall { id: string; type: "function"; function: {...} }
// 现在：
//   const ToolCall = Schema.Struct({...})
//   type ToolCall = Schema.Schema.Type<typeof ToolCall>
//
// Schema.Struct 定义一次，同时得到：
//   - 编译期类型：Schema.Schema.Type<typeof ToolCall>（TS 检查用）
//   - 运行期校验：Schema.decodeUnknownSync(ToolCall)（阶段 13 学过）
export const ToolCall = Schema.Struct({
  id: Schema.String, // 这次调用的唯一 ID（喂回结果时要带上）
  type: Schema.Literal("function"), // 固定值（Literal：只能等于 "function"）
  function: Schema.Struct({
    name: Schema.String, // 工具名（如 "read"）
    arguments: Schema.String, // 参数，是 JSON 字符串（不是对象，要 JSON.parse）
  }),
})

// 从 Schema 推导出 TS 类型（编译期用）
export type ToolCall = Schema.Schema.Type<typeof ToolCall>

// ─────────────────────────────────────────────────────────────
// 一条消息
// ─────────────────────────────────────────────────────────────
// role 是四种取值之一 → Schema.Literals（联合字面量）
// content 可以是 null → Schema.NullOr（允许 string 或 null）
// tool_calls / tool_call_id 可选 → Schema.optional
export const Message = Schema.Struct({
  // Schema.Literals(["system", "user", ...])：只能取这几个值之一（联合类型）
  // 类比 Python 的 Literal["system", "user", "assistant", "tool"]
  role: Schema.Literals(["system", "user", "assistant", "tool"]),
  // NullOr(string)：允许 string 或 null（assistant 带 tool_calls 时 content 是 null）
  content: Schema.NullOr(Schema.String),
  // optional：可选字段（LLM 返回工具调用时 assistant 消息才有）
  tool_calls: Schema.optional(Schema.Array(ToolCall)),
  // 只有 tool 消息有（对应 tool_calls 的 id）
  tool_call_id: Schema.optional(Schema.String),
})

export type Message = Schema.Schema.Type<typeof Message>

// ─────────────────────────────────────────────────────────────
// 配置文件里的 provider 结构
// ─────────────────────────────────────────────────────────────
export const ProviderConfig = Schema.Struct({
  name: Schema.String,
  baseURL: Schema.String,
  apiKey: Schema.String,
  // Record(string, unknown)：任意对象（models 字段的结构由 provider 自己定义）
  models: Schema.Record(Schema.String, Schema.Unknown),
})

export type ProviderConfig = Schema.Schema.Type<typeof ProviderConfig>

// ─────────────────────────────────────────────────────────────
// 配置文件结构
// ─────────────────────────────────────────────────────────────
export const Config = Schema.Struct({
  model: Schema.String, // "provider/model" 格式
  // Record(string, ProviderConfig)：多个 provider，用名字做 key
  provider: Schema.Record(Schema.String, ProviderConfig),
})

export type Config = Schema.Schema.Type<typeof Config>

// ─────────────────────────────────────────────────────────────
// 解析后的运行配置（和"配置文件结构"不同）
// ─────────────────────────────────────────────────────────────
// 配置文件：{ model: "provider/model", provider: { ... } }（用户手写，未解析）
// 运行配置：{ baseURL, apiKey, modelID }（loadConfig 解析后，程序真正用的）
// 之前这个类型定义在 src/service/config.ts 里（本地 interface），
// 阶段 15 把它也搬进 schema 包，消除重复定义。
export const ResolvedConfig = Schema.Struct({
  baseURL: Schema.String,
  apiKey: Schema.String,
  modelID: Schema.String,
})

export type ResolvedConfig = Schema.Schema.Type<typeof ResolvedConfig>

