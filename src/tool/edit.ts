// src/tool/edit.ts
// edit 工具：精确字符串替换
// 对照 opencode: packages/opencode/src/tool/edit.ts
// opencode 的 edit 也是精确匹配 + 多处报错 + replaceAll 选项

import type { Tool, JSONSchema } from "./tool"
import DESCRIPTION from "./edit.txt"

const parameters: JSONSchema = {
  type: "object",
  properties: {
    filePath: {
      type: "string",
      description: "文件路径",
    },
    oldString: {
      type: "string",
      description: "要替换的原文（必须精确匹配，包括空格和换行）",
    },
    newString: {
      type: "string",
      description: "替换后的新文本",
    },
    replaceAll: {
      type: "boolean",
      description: "是否替换所有匹配（默认 false，只替换第一个）",
    },
  },
  required: ["filePath", "oldString", "newString"],
}

async function execute(args: Record<string, unknown>): Promise<string> {
  const filePath = args.filePath as string
  const oldString = args.oldString as string
  const newString = args.newString as string
  const replaceAll = args.replaceAll as boolean | undefined

  // 1. 读文件
  const file = Bun.file(filePath)
  const exists = await file.exists()
  if (!exists) {
    return `错误：文件 ${filePath} 不存在`
  }

  const content = await file.text()

  // 2. 检查 oldString 是否存在
  if (!content.includes(oldString)) {
    return `错误：在 ${filePath} 中找不到 oldString`
  }

  // 3. 检查是否有多处匹配（非 replaceAll 模式下报错）
  // 这是为了防止意外改错地方——如果有多处匹配，LLM 应该提供更多上下文
  if (!replaceAll) {
    const firstIndex = content.indexOf(oldString)
    const secondIndex = content.indexOf(oldString, firstIndex + 1)
    if (secondIndex !== -1) {
      return `错误：在 ${filePath} 中找到多处匹配，请提供更多上下文或使用 replaceAll`
    }
  }

  // 4. 替换
  // replaceAll: 用 split + join 替换所有（String.replaceAll 的兼容写法）
  // 非 replaceAll: 用 replace 只替换第一个
  const newContent = replaceAll
    ? content.split(oldString).join(newString)
    : content.replace(oldString, newString)

  // 5. 写回文件
  await Bun.write(filePath, newContent)

  return `已编辑 ${filePath}`
}

export const editTool: Tool = {
  id: "edit",
  description: DESCRIPTION,
  parameters,
  execute,
}
