// src/tool-demo.ts
// 3.2 课教学代码：直接调用 read 工具，验证它能读文件
// 跑法：bun run src/tool-demo.ts

import { readTool } from "./tool/read"
import { toolToOpenAIFormat } from "./tool/tool"

// 1. 看看 read 工具转成 OpenAI API 格式长什么样
console.log("=== read 工具的 OpenAI API 格式 ===")
console.log(JSON.stringify(toolToOpenAIFormat(readTool), null, 2))

// 2. 直接调用 read 工具读自己的源码
console.log("\n=== 调用 read 工具读 src/tool/read.ts ===")
const result = await readTool.execute({ filePath: "src/tool/read.ts" })
console.log(result)
