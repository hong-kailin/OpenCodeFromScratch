// src/tool/write.ts
// write 工具：写文件（不存在则创建，存在则覆盖）
// 对照 opencode: packages/opencode/src/tool/write.ts
//
// 阶段 13 改动：参数定义从手写 JSON Schema 改为 Effect Schema（单一来源）

import { Schema } from "effect"
import type { Tool } from "./tool"
import DESCRIPTION from "./write.txt"

export const Parameters = Schema.Struct({
  filePath: Schema.String.annotate({ description: "文件路径" }),
  content: Schema.String.annotate({ description: "要写入的完整内容" }),
})

async function execute(args: Schema.Schema.Type<typeof Parameters>): Promise<string> {
  const { filePath, content } = args

  // Bun.write：写文件（类比 Python open(path, "w").write(content)）
  // 不存在则创建，存在则覆盖
  await Bun.write(filePath, content)

  return `已写入 ${filePath}（${content.length} 字符）`
}

export const writeTool: Tool<typeof Parameters> = {
  id: "write",
  description: DESCRIPTION,
  parameters: Parameters,
  execute,
}
