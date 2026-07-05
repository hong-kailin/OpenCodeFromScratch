// src/tool/grep.ts
// grep 工具：按正则表达式搜索文件内容
// 对照 opencode: packages/opencode/src/tool/grep.ts（opencode 底层用 ripgrep）

import type { Tool, JSONSchema } from "./tool"
import DESCRIPTION from "./grep.txt"

const parameters: JSONSchema = {
  type: "object",
  properties: {
    pattern: {
      type: "string",
      description: "正则表达式",
    },
    include: {
      type: "string",
      description: "文件过滤模式（如 *.ts），默认搜索所有文件",
    },
  },
  required: ["pattern"],
}

async function execute(args: Record<string, unknown>): Promise<string> {
  const pattern = args.pattern as string
  const include = (args.include as string) || "**/*"

  // 编译正则表达式（i 表示不区分大小写）
  // 类比 Python: re.compile(pattern, re.IGNORECASE)
  const regex = new RegExp(pattern, "i")

  const results: string[] = []

  // 1. 用 glob 找到要搜索的文件
  const glob = new Bun.Glob(include)

  for await (const filePath of glob.scan(".")) {
    // 跳过 node_modules 和 opencode 目录
    if (filePath.startsWith("node_modules") || filePath.startsWith("opencode")) continue

    // 2. 读文件内容
    const file = Bun.file(filePath)
    const exists = await file.exists()
    if (!exists) continue

    const text = await file.text()
    const lines = text.split("\n")

    // 3. 逐行匹配
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (line && regex.test(line)) {
        // 输出格式和 ripgrep 一样：文件路径:行号: 内容
        results.push(`${filePath}:${i + 1}: ${line.trim()}`)
      }
    }
  }

  if (results.length === 0) return "没有找到匹配的内容"
  return results.join("\n")
}

export const grepTool: Tool = {
  id: "grep",
  description: DESCRIPTION,
  parameters,
  execute,
}
