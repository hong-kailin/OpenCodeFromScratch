// src/tool/read.ts
// read 工具：读取本地文件，返回带行号的文本
// 对照 opencode: packages/opencode/src/tool/read.ts
// opencode 的 read 工具有 offset/limit/截断/权限/二进制检测等，我们先用最简版

import type { Tool, JSONSchema } from "./tool"
import DESCRIPTION from "./read.txt"

// 参数定义：用 JSON Schema 描述 read 工具需要什么参数
// 对照 opencode: 它用 Effect Schema，我们直接用 JSON Schema
const parameters: JSONSchema = {
  type: "object",
  properties: {
    filePath: {
      type: "string",
      description: "要读取的文件路径",
    },
  },
  required: ["filePath"],
}

// 执行函数：读文件 → 加行号 → 返回文本
// 对照 opencode: 它的 run() 函数有 150+ 行（分页、二进制、图片、权限等）
// 我们的只有几行：读文件、加行号、返回
async function execute(args: Record<string, unknown>): Promise<string> {
  const filePath = args.filePath as string

  // 用 Bun.file 读文件（0.4 课学过）
  const file = Bun.file(filePath)
  const exists = await file.exists()
  if (!exists) {
    return `错误：文件 ${filePath} 不存在`
  }

  // 读取文本内容
  const text = await file.text()
  const lines = text.split("\n")

  // 加行号：每行格式 "行号: 内容"（和 opencode 一样）
  // 例如：1: console.log("hello")
  const numbered = lines
    .map((line, i) => `${i + 1}: ${line}`)
    .join("\n")

  // 输出格式和 opencode 一致：<path> + <type> + <content>
  let output = `${filePath}\n<type>file</type>\n<content>\n`
  output += numbered
  output += "\n</content>"

  return output
}

// read 工具的完整定义
export const readTool: Tool = {
  id: "read",
  description: DESCRIPTION,
  parameters,
  execute,
}
