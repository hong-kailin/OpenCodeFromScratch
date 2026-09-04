// src/error/errors.ts
// 阶段 13 教学代码：Typed Errors——带 tag 的类型化错误
//
// 对比：之前用 throw new Error("字符串")，调用方只能 catch 所有 Error，
// 无法精确区分"配置错误"还是"LLM 调用失败"还是"工具执行失败"。
//
// 现在用 Data.TaggedError：每个错误类型有唯一的 tag，
// 调用方可以用 Effect.catchTag("TagName") 精确捕获。
//
// 对照 Python 的自定义异常类：
//   class ConfigError(Exception): pass
//   → class ConfigError extends Data.TaggedError("ConfigError")<{...}> {}

import { Data } from "effect"

// 配置错误：读不到配置文件、找不到 provider 等
export class ConfigError extends Data.TaggedError("ConfigError")<{
  readonly message: string
}> {}

// LLM 调用错误：API 返回错误、网络超时等
export class LLMError extends Data.TaggedError("LLMError")<{
  readonly message: string
}> {}

// 工具执行错误：工具找不到、参数校验失败、执行失败等
export class ToolError extends Data.TaggedError("ToolError")<{
  readonly message: string
  readonly toolName?: string
}> {}