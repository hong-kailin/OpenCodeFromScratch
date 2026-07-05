// src/tool/write.ts
// write 工具：写文件（不存在则创建，存在则覆盖）
// 对照 opencode: packages/opencode/src/tool/write.ts

import type { Tool, JSONSchema } from "./tool"
import DESCRIPTION from "./write.txt"

const parameters: JSONSchema = {
  type: "object",
  properties: {
    filePath: {
      type: "string",
      description: "文件路径",
    },
    content: {
      type: "string",
      description: "要写入的完整内容",
    },
  },
  required: ["filePath", "content"],
}

async function execute(args: Record<string, unknown>): Promise<string> {
  const filePath = args.filePath as string
  const content = args.content as string

  // Bun.write：写文件（类比 Python open(path, "w").write(content)）
  // 不存在则创建，存在则覆盖
  await Bun.write(filePath, content)

  return `已写入 ${filePath}（${content.length} 字符）`
}

export const writeTool: Tool = {
  id: "write",
  description: DESCRIPTION,
  parameters,
  execute,
}
