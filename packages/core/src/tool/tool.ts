// src/tool/tool.ts
// Tool 接口定义：所有工具都实现这个接口
// 对照 opencode: packages/opencode/src/tool/tool.ts 的 Def 接口
//
// 阶段 13 改动：参数定义从"手写 JSON Schema"升级为"Effect Schema"（单一来源）。
// 之前：
//   parameters: JSONSchema  —— 手写 { type: "object", properties: {...} }
//   execute(args: Record<string, unknown>)
//   LLM 看到的 JSON Schema 和运行期校验是两套东西，各工具手写一份，容易不一致
// 现在：
//   parameters: Schema.Decoder<unknown>  —— Effect Schema，单一来源
//   execute(args: Schema.Schema.Type<Parameters>)
//   LLM 看到的 JSON Schema 由 toJSONSchema() 从同一 Schema 自动生成（对照 opencode 的 json-schema.ts）
//   运行期校验由 agent-loop 用 Schema.decodeUnknownEffect 完成（对照 opencode tool.ts 的 wrap）
//
// 阶段 16.3 改动：execute 从 Promise 升级为 Effect（对照 opencode 的真实签名）。
// 之前：
//   execute(args): Promise<string>          —— 工具直接调 Bun/file，拿不到 Context
// 现在：
//   execute(args): Effect.Effect<string>    —— 工具内部 yield* FileSystem.Service 取依赖
// 为什么：阶段 16 把文件操作收进 FileSystem 服务，工具必须能"从 Context 取服务"。
//   Promise 函数体内没有 Context，Effect 函数体里有（yield* 就是取服务的语法）。
//   agent-loop 调用处也简化：不用再包一层 Effect.promise。

import { Effect, Schema } from "effect"

// 一个工具的完整定义（泛型 Parameters：本工具的参数 Schema）
// 对照 opencode 的 Def 接口，我们简化了：
// - 去掉 Context（后续阶段加权限/abort 等）
// - execute 返回 Effect<string>（opencode 返回 Effect<ExecuteResult>，更复杂）
// 关键点：parameters 既是"类型定义"又是"运行期校验器"——
//   Schema.Schema.Type<Parameters> 推导出 execute 的 args 类型（编译期类型安全）
//   Schema.decodeUnknownEffect(parameters) 是运行期校验（agent-loop 里调用）
export interface Tool<
  Parameters extends Schema.Decoder<unknown> = Schema.Decoder<unknown>,
  R = never,
> {
  id: string // 工具名（LLM 用这个名字调用，如 "read"）
  description: string // 工具说明（LLM 根据这个决定要不要用）
  parameters: Parameters // 参数格式（Effect Schema，单一来源）
  // execute 返回 Effect<string>，第三泛型 R 是"这个工具需要哪些服务"
  // 例如 read 工具需要 FileSystemService，所以它的 execute 类型是
  // Effect.Effect<string, never, FileSystemService>——类型系统会强制
  // "执行 read 时 Context 里必须有 FileSystemService"，否则编译报错
  execute(args: Schema.Schema.Type<Parameters>): Effect.Effect<string, never, R> // 执行函数，返回文本结果
}

// ─────────────────────────────────────────────────────────────────
// 从 Effect Schema 生成 JSON Schema（给 LLM 看的参数格式）
// 对照 opencode: packages/opencode/src/tool/json-schema.ts 的 fromSchema
// 之前手写 JSONSchema，现在从 Schema 自动生成——保证 LLM 看到的和运行期校验的是同一份定义
// ─────────────────────────────────────────────────────────────────

// normalize：把 Schema.toJsonSchemaDocument 的输出清洗成更干净的 JSON Schema
// 为什么需要：Schema.optional 字段会生成 anyOf 分支（如 [boolean, null]，
// 以及 number 的 NaN/Infinity 噪音分支），对 LLM 不友好。
// 清洗规则：
//   1. anyOf 里去掉 null 分支（optional 字段的 null 选项没意义）
//   2. anyOf 只剩一个分支时，直接展开成普通字段（不保留 anyOf 键）
//   3. 嵌套的 anyOf 递归处理
function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize)
  if (typeof value !== "object" || value === null) return value

  const record = value as Record<string, unknown>
  // anyOf 节点：去掉 null 分支；只剩一个分支就展开
  if (Array.isArray(record.anyOf)) {
    const branches = (record.anyOf as unknown[]).filter(
      (sub) => !(typeof sub === "object" && sub !== null && (sub as Record<string, unknown>).type === "null"),
    )
    // 只剩一个分支：展开成该分支（丢掉 anyOf 包装），再递归清洗
    if (branches.length === 1) {
      // 把外层节点的 description 等注解合并进展开后的分支
      // 原因：Schema.optional(Schema.Boolean).annotate({description}) 时，
      // description 挂在 anyOf 外层，展开时丢了会让 LLM 看不到字段说明
      const { anyOf: _, ...rest } = record
      return normalize({ ...rest, ...(branches[0] as Record<string, unknown>) })
    }
    // 多个分支：保留 anyOf（仍是数组），递归清洗每个分支
    if (branches.length > 0) {
      const { anyOf, ...rest } = record
      return normalize({ ...rest, anyOf: normalize(branches) })
    }
  }

  // 普通对象：递归清洗每个字段
  const result: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(record)) {
    result[key] = normalize(item)
  }
  return result
}

// 从 Effect Schema 生成 JSON Schema
// Schema.toJsonSchemaDocument 是 effect 内置转换：Schema → JSON Schema draft 2020-12
export function toJSONSchema(schema: Schema.Decoder<unknown>): Record<string, unknown> {
  // additionalProperties: true —— 允许未知字段，更宽容（opencode 也一样）
  const document = Schema.toJsonSchemaDocument(schema as Schema.Top, { additionalProperties: true })
  return normalize(document.schema) as Record<string, unknown>
}

// 把我们的 Tool 定义转成 OpenAI API 的 tools 格式
// API 需要的格式：{ type: "function", function: { name, description, parameters } }
// parameters 不再手写——用 toJSONSchema 从工具的 Schema 自动生成
export function toolToOpenAIFormat(tool: Tool<any, any>) {
  return {
    type: "function" as const,
    function: {
      name: tool.id,
      description: tool.description,
      parameters: toJSONSchema(tool.parameters),
    },
  }
}
