// src/tool/glob.ts
// glob 工具：按文件名模式匹配文件
// 对照 opencode: packages/opencode/src/tool/glob.ts（opencode 底层用 fast-glob 包）
//
// 阶段 13 改动：参数定义从手写 JSON Schema 改为 Effect Schema（单一来源）
// 阶段 16.4 改动：execute 改 Effect，glob 走 FileSystem 服务（跳过规则在服务里统一管）

import { Effect, Schema } from "effect"
import type { Tool } from "./tool"
import { FileSystemService } from "../filesystem"
import DESCRIPTION from "./glob.txt"

export const Parameters = Schema.Struct({
  pattern: Schema.String.annotate({ description: "glob 模式（如 **/*.ts）" }),
})

const execute = (args: Schema.Schema.Type<typeof Parameters>) =>
  Effect.gen(function* () {
    const { pattern } = args

    // 从 Context 取 FileSystem 服务，用服务 glob
    // 跳过 node_modules/opencode 的逻辑收在服务里，工具不再重复写
    const fs = yield* FileSystemService
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
