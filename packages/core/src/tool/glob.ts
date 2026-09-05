// src/tool/glob.ts
// glob 工具：按文件名模式匹配文件
// 对照 opencode: packages/opencode/src/tool/glob.ts（opencode 底层用 fast-glob 包）
//
// 阶段 13 改动：参数定义从手写 JSON Schema 改为 Effect Schema（单一来源）
// 阶段 16.3 改动：execute 改 Effect，匹配逻辑走 FileSystem 服务

import { Effect, Schema } from "effect"
import type { Tool } from "./tool"
import { FileSystemService } from "../filesystem"
import DESCRIPTION from "./glob.txt"

export const Parameters = Schema.Struct({
  pattern: Schema.String.annotate({ description: "glob 模式（如 **/*.ts）" }),
})

const execute = (args: Schema.Schema.Type<typeof Parameters>) =>
  Effect.gen(function* () {
    const fs = yield* FileSystemService
    const { pattern } = args

    // 匹配逻辑走 FileSystem 服务（跳过 node_modules/opencode 在服务里统一处理）
    const paths = yield* Effect.promise(() => fs.glob(pattern))

    if (paths.length === 0) return "没有找到匹配的文件"
    return paths.join("\n")
  })

export const globTool: Tool<typeof Parameters, FileSystemService> = {
  id: "glob",
  description: DESCRIPTION,
  parameters: Parameters,
  execute,
}
