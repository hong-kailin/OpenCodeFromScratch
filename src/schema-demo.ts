// src/schema-demo.ts
// 阶段 13 教学代码：Effect Schema + Typed Errors 演示
// 跑法：bun run src/schema-demo.ts
//
// 两个核心概念：
// 1. Schema：声明式数据契约——编译期是 TS 类型，运行期是校验器
// 2. Data.TaggedError：带 tag 的类型化错误——精确捕获，区分不同错误类型

import { Schema, Effect, Data } from "effect"

// ═══════════════════════════════════════════════════════════════
// 1. Schema 基础：声明式数据契约
// ═══════════════════════════════════════════════════════════════
// Schema.Struct 定义一个"对象应该长什么样"。
// 它既是 TS 类型（编译期），又是校验器（运行期）。

const UserSchema = Schema.Struct({
  name: Schema.String,
  age: Schema.Number,
})

// 从 Schema 推导出 TS 类型（编译期：类型检查）
type User = typeof UserSchema.Type

console.log("=== 1. Schema 基础 ===")

// decodeUnknownSync：运行时校验 + 解析
const valid = Schema.decodeUnknownSync(UserSchema)({ name: "Alice", age: 30 })
console.log("合法输入:", valid) // { name: "Alice", age: 30 }

// 非法输入：age 是字符串，不是数字
try {
  Schema.decodeUnknownSync(UserSchema)({ name: "Bob", age: "三十" })
} catch (e) {
  console.log("非法输入被拦截:", e instanceof Error ? e.message : e)
}

// ═══════════════════════════════════════════════════════════════
// 2. Schema 的双重身份：类型 + 校验
// ═══════════════════════════════════════════════════════════════
// 以前：interface + JSON.parse + 手动校验
//   interface User { name: string; age: number }
//   const user = JSON.parse(str) as User  // 没有任何校验！
//
// 现在：Schema 定义一次，类型和校验都有
//   const UserSchema = Schema.Struct({ name: Schema.String, age: Schema.Number })
//   type User = typeof UserSchema.Type  // 不用手动写 interface
//   const user = Schema.decodeUnknownSync(UserSchema)(input)  // 自动校验

console.log("\n=== 2. Schema 的双重身份 ===")
console.log("Schema 定义一次，编译期是 TS 类型，运行期是校验器")

// ═══════════════════════════════════════════════════════════════
// 3. 模拟工具参数校验
// ═══════════════════════════════════════════════════════════════
// 真实场景：LLM 返回的 tool_calls 里 arguments 是 JSON 字符串

const ReadArgs = Schema.Struct({
  filePath: Schema.String,
})

const WriteArgs = Schema.Struct({
  filePath: Schema.String,
  content: Schema.String,
})

console.log("\n=== 3. 工具参数校验 ===")

// 合法参数
const correctArgs = JSON.parse('{"filePath": "src/index.ts"}')
const parsed = Schema.decodeUnknownSync(ReadArgs)(correctArgs)
console.log("read 合法参数:", parsed.filePath) // "src/index.ts"

// 非法参数
try {
  Schema.decodeUnknownSync(ReadArgs)(JSON.parse('{"wrongField": "oops"}'))
} catch (e) {
  console.log("read 非法参数被拦截:", e instanceof Error ? e.message : e)
}

// write 工具参数
const writeArgs = JSON.parse('{"filePath": "out.txt", "content": "hello"}')
const parsedWrite = Schema.decodeUnknownSync(WriteArgs)(writeArgs)
console.log("write 合法参数:", parsedWrite.filePath, parsedWrite.content)

// ═══════════════════════════════════════════════════════════════
// 4. Data.TaggedError：带 tag 的类型化错误
// ═══════════════════════════════════════════════════════════════
// 之前：throw new Error("字符串")——无法精确区分
// 现在：Data.TaggedError——每个错误有唯一 tag

// 定义两个错误类型
// Data.TaggedError("Name")<{...}> 创建带 tag 的错误类
class ConfigError extends Data.TaggedError("ConfigError")<{
  readonly message: string
}> {}

class LLMError extends Data.TaggedError("LLMError")<{
  readonly message: string
}> {}

console.log("\n=== 4. Typed Errors 精确捕获 ===")

// 模拟一个可能产生两种错误的 Effect
const riskyOperation = Effect.gen(function* () {
  const random = Math.random()
  if (random < 0.5) {
    return yield* Effect.fail(new ConfigError({ message: "配置文件不存在" }))
  } else {
    return yield* Effect.fail(new LLMError({ message: "API 调用超时" }))
  }
})

// 用 catchTag 精确捕获不同错误
const handled = riskyOperation.pipe(
  Effect.catchTag("ConfigError", (e) =>
    Effect.succeed(`配置错误，已处理: ${e.message}`),
  ),
  Effect.catchTag("LLMError", (e) =>
    Effect.succeed(`LLM 错误，已处理: ${e.message}`),
  ),
)

const result = await Effect.runPromise(handled)
console.log("精确捕获结果:", result)

// 对比：如果不用 TaggedError，只能靠字符串匹配
//   catch (e) {
//     if (e.message.includes("配置")) { ... }
//     else if (e.message.includes("超时")) { ... }
//   }

// ═══════════════════════════════════════════════════════════════
// 5. Effect.catch：兜底捕获
// ═══════════════════════════════════════════════════════════════

console.log("\n=== 5. catch 兜底 ===")

const unknownError = Effect.fail(new Error("未知错误"))

const safe = unknownError.pipe(
  Effect.catch((e) =>
    Effect.succeed(`兜底捕获: ${e instanceof Error ? e.message : String(e)}`),
  ),
)

const safeResult = await Effect.runPromise(safe)
console.log("兜底捕获结果:", safeResult)

// ═══════════════════════════════════════════════════════════════
// 小结
// ═══════════════════════════════════════════════════════════════
// - Schema.Struct 定义一次，类型 + 校验都有
// - Schema.decodeUnknownSync 运行期校验
// - Data.TaggedError("Name")<{...}> 创建带 tag 的错误类
// - Effect.catchTag("TagName") 精确捕获
// - Effect.catch 兜底捕获所有错误