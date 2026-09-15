// src/tool/read.ts
// read 工具：读取本地文件，返回带行号的文本
// 对照 opencode: packages/opencode/src/tool/read.ts
// opencode 的 read 工具有 offset/limit/截断/权限/二进制检测等，我们先用最简版
//
// 阶段 13 改动：参数定义从手写 JSON Schema 改为 Effect Schema（单一来源）。
// 对照 opencode: 它用 Schema.Struct 定义 Parameters，JSON Schema 自动生成
//   const Parameters = Schema.Struct({ filePath: Schema.String.annotate({...}) })
//
// 阶段 16.4 改动：execute 从"直接调 Bun.file"改为"从 Context 取 FileSystem 服务"。
// 之前：execute 直接 Bun.file(filePath)，I/O 和工具逻辑耦合，无法 mock
// 现在：execute 内部 yield* FileSystemService，文件操作走服务（可替换实现）
// 注意 execute 返回 Effect——这是"工具从 Context 取依赖"的前提。

import { Effect, Layer, Schema } from "effect"
import type { Tool } from "./tool"
import { FileSystemService } from "../filesystem"
import { ToolRegistry } from "./registry"
import DESCRIPTION from "./read.txt"

// 参数定义：用 Effect Schema 描述 read 工具需要什么参数
// 它既是 TS 类型（execute 的 args 类型自动推导），又是运行期校验器
// annotate({ description })：给字段加说明，会出现在生成的 JSON Schema 里（LLM 看的）
export const Parameters = Schema.Struct({
  filePath: Schema.String.annotate({ description: "要读取的文件路径" }),
})

// 执行函数：读文件 → 加行号 → 返回文本（现在返回 Effect）
// 对照 opencode: 它的 run() 函数有 150+ 行（分页、二进制、图片、权限等）
// 我们的只有几行：读文件、加行号、返回
// args 类型由 Parameters 推导：{ filePath: string }，不再需要 as 断言
const execute = (args: Schema.Schema.Type<typeof Parameters>) =>
  Effect.gen(function* () {
    // yield* FileSystemService：从 Context 取 FileSystem 服务
    // 文件操作（read/exists）都走服务——测试时替换 fileSystemLayer 即可 mock
    const fs = yield* FileSystemService
    const filePath = args.filePath

    // 用服务读文件（文件不存在返回 null）
    // fs.read 返回 Promise，用 Effect.promise 桥接进 Effect 世界
    const text = yield* Effect.promise(() => fs.read(filePath))
    if (text === null) {
      return `错误：文件 ${filePath} 不存在`
    }

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
  })

// read 工具的完整定义
// 泛型参数 Tool<typeof Parameters, FileSystemService>：
//   - 第一个泛型：参数 Schema（execute 的 args 类型由此推导）
//   - 第二个泛型 R = FileSystemService：声明"执行 read 需要 FileSystem 服务"
//     类型系统会强制调用方 provide 该服务，否则编译报错
export const readTool: Tool<typeof Parameters, FileSystemService> = {
  id: "read",
  description: DESCRIPTION,
  parameters: Parameters,
  execute,
}

// ── 自注册 Layer（阶段 16.5，对照 opencode 每个工具文件里的 layer）──
// 每个工具在自己的文件里有一个 Layer，启动时 register 自己。
// 组装方（入口的 toolsLayer）只要 merge 这个 Layer，
// read 工具就会被注册进 ToolRegistry——不需要任何中央工具列表。
// Layer.effectDiscard：效果执行完不留值（注册是副作用，没有返回值）
export const readToolLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    // 从 Context 取注册表，把自己注册进去
    const registry = yield* ToolRegistry
    registry.register(readTool)
  }),
)
