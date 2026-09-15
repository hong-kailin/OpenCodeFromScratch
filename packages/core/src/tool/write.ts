// src/tool/write.ts
// write 工具：写文件（不存在则创建，存在则覆盖）
// 对照 opencode: packages/opencode/src/tool/write.ts
//
// 阶段 13 改动：参数定义从手写 JSON Schema 改为 Effect Schema（单一来源）
// 阶段 16.4 改动：execute 改 Effect，文件操作走 FileSystem 服务（从 Context 取）

import { Effect, Layer, Schema } from "effect"
import type { Tool } from "./tool"
import { FileSystemService } from "../filesystem"
import { ToolRegistry } from "./registry"
import DESCRIPTION from "./write.txt"

export const Parameters = Schema.Struct({
  filePath: Schema.String.annotate({ description: "文件路径" }),
  content: Schema.String.annotate({ description: "要写入的完整内容" }),
})

const execute = (args: Schema.Schema.Type<typeof Parameters>) =>
  Effect.gen(function* () {
    const { filePath, content } = args

    // 从 Context 取 FileSystem 服务，用服务写文件
    const fs = yield* FileSystemService
    yield* Effect.promise(() => fs.write(filePath, content))

    return `已写入 ${filePath}（${content.length} 字符）`
  })

// R = FileSystemService：写文件需要 FileSystem 服务
export const writeTool: Tool<typeof Parameters, FileSystemService> = {
  id: "write",
  description: DESCRIPTION,
  parameters: Parameters,
  execute,
}

// 自注册 Layer（16.5）：启动时把自己注册进 ToolRegistry
export const writeToolLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const registry = yield* ToolRegistry
    registry.register(writeTool)
  }),
)
