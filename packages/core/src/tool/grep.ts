// src/tool/grep.ts
// grep 工具：按正则表达式搜索文件内容
// 对照 opencode: packages/opencode/src/tool/grep.ts（opencode 底层用 ripgrep）
//
// 阶段 13 改动：参数定义从手写 JSON Schema 改为 Effect Schema（单一来源）
// include 是可选字段，用 Schema.optional
// 阶段 16.3 改动：execute 改 Effect，搜索逻辑走 FileSystem 服务

import { Effect, Schema } from "effect"
import type { Tool } from "./tool"
import { FileSystemService } from "../filesystem"
import DESCRIPTION from "./grep.txt"

export const Parameters = Schema.Struct({
  pattern: Schema.String.annotate({ description: "正则表达式" }),
  include: Schema.optional(Schema.String).annotate({
    description: "文件过滤模式（如 *.ts），默认搜索所有文件",
  }),
})

const execute = (args: Schema.Schema.Type<typeof Parameters>) =>
  Effect.gen(function* () {
    const fs = yield* FileSystemService
    const { pattern } = args
    const include = args.include || "**/*"

    // 搜索逻辑走 FileSystem 服务（glob 找文件 + 读内容 + 正则匹配）
    const results = yield* Effect.promise(() => fs.grep(pattern, include))

    if (results.length === 0) return "没有找到匹配的内容"
    return results.join("\n")
  })

export const grepTool: Tool<typeof Parameters, FileSystemService> = {
  id: "grep",
  description: DESCRIPTION,
  parameters: Parameters,
  execute,
}
