// src/tool/glob.ts
// glob 工具：按文件名模式匹配文件
// 对照 opencode: packages/opencode/src/tool/glob.ts（opencode 底层用 fast-glob 包）
//
// 阶段 13 改动：参数定义从手写 JSON Schema 改为 Effect Schema（单一来源）

import { Schema } from "effect"
import type { Tool } from "./tool"
import DESCRIPTION from "./glob.txt"

export const Parameters = Schema.Struct({
  pattern: Schema.String.annotate({ description: "glob 模式（如 **/*.ts）" }),
})

async function execute(args: Schema.Schema.Type<typeof Parameters>): Promise<string> {
  const { pattern } = args

  // Bun.Glob：内置的文件模式匹配
  // 类比 Python: glob.glob(pattern, recursive=True)
  const glob = new Bun.Glob(pattern)
  const paths: string[] = []

  // scan(".") 从当前目录递归扫描
  for await (const path of glob.scan(".")) {
    // 跳过 node_modules 和 opencode 目录
    if (path.startsWith("node_modules") || path.startsWith("opencode")) continue
    paths.push(path)
  }

  if (paths.length === 0) return "没有找到匹配的文件"
  return paths.join("\n")
}

export const globTool: Tool<typeof Parameters> = {
  id: "glob",
  description: DESCRIPTION,
  parameters: Parameters,
  execute,
}
