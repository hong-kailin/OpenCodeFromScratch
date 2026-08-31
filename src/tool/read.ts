// src/tool/read.ts
// read 工具：读取本地文件，返回带行号的文本
// 对照 opencode: packages/opencode/src/tool/read.ts
// opencode 的 read 工具有 offset/limit/截断/权限/二进制检测等，我们先用最简版
//
// 阶段 13 改动：参数定义从手写 JSON Schema 改为 Effect Schema（单一来源）。
// 对照 opencode: 它用 Schema.Struct 定义 Parameters，JSON Schema 自动生成
//   const Parameters = Schema.Struct({ filePath: Schema.String.annotate({...}) })

import { Schema } from "effect"
import type { Tool } from "./tool"
import DESCRIPTION from "./read.txt"

// 参数定义：用 Effect Schema 描述 read 工具需要什么参数
// 它既是 TS 类型（execute 的 args 类型自动推导），又是运行期校验器
// annotate({ description })：给字段加说明，会出现在生成的 JSON Schema 里（LLM 看的）
export const Parameters = Schema.Struct({
  filePath: Schema.String.annotate({ description: "要读取的文件路径" }),
})

// 执行函数：读文件 → 加行号 → 返回文本
// 对照 opencode: 它的 run() 函数有 150+ 行（分页、二进制、图片、权限等）
// 我们的只有几行：读文件、加行号、返回
// args 类型由 Parameters 推导：{ filePath: string }，不再需要 as 断言
async function execute(args: Schema.Schema.Type<typeof Parameters>): Promise<string> {
  const filePath = args.filePath

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
// 泛型参数 Tool<typeof Parameters>：把参数 Schema 传给 Tool 接口
// 这样 Tool.parameters 的类型是具体的 Schema，execute 的 args 类型也能对上
export const readTool: Tool<typeof Parameters> = {
  id: "read",
  description: DESCRIPTION,
  parameters: Parameters,
  execute,
}
