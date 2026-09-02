// src/tool-generic-demo.ts
// 阶段 13.3 教学代码：泛型 Tool 接口——类型安全从哪来
// 跑法：bun run src/tool-generic-demo.ts
//
// 解答一个问题：阶段 13 的 Tool 接口为什么是
//   export interface Tool<Parameters extends Schema.Decoder<unknown> = Schema.Decoder<unknown>>
// 而不是简单的
//   export interface Tool { parameters: Schema.Decoder<unknown>; execute(args: any) }
//
// 核心：泛型让"每个工具的 execute 参数类型"由它自己的 Schema 推导出来——
// 编译期就用类型锁死，写错字段/类型在编译时就报错，而不是运行期才爆雷。
//
// 本 demo 分三部分：
//   1. 泛型 Tool 接口：三个部分逐词拆解（参数名 / extends 约束 / 默认值）
//   2. 类型推导：Tool<typeof Parameters> 后 execute 的 args 是什么类型
//   3. 对比旧版：Record<string, unknown> 为什么"等于没约束"

import { Schema } from "effect"

// ─────────────────────────────────────────────────────────────
// 1. 泛型 Tool 接口（和 src/tool/tool.ts 一致）
// ─────────────────────────────────────────────────────────────
// 逐词拆解 <Parameters extends Schema.Decoder<unknown> = Schema.Decoder<unknown>>：
//   Parameters                      —— 泛型参数名：本工具的参数 Schema
//   extends Schema.Decoder<unknown> —— 约束：Parameters 必须是"一个 Schema"
//                                        （Decoder<unknown> = 能解码 unknown 输入的东西）
//   = Schema.Decoder<unknown>       —— 默认值：不显式传泛型时用这个（宽容，任何 Schema 都行）
// 类比 Python：
//   def make_tool(Parameters: Type[T]) -> T: ...   # 类型参数，运行时是具体的类型
//   只不过 TS 的泛型在编译期就展开，且能推导 execute 的签名
export interface Tool<Parameters extends Schema.Decoder<unknown> = Schema.Decoder<unknown>> {
  id: string
  description: string
  parameters: Parameters
  // ⭐ 关键：args 的类型 = Schema 推导出的"参数类型"
  // Schema.Schema.Type<Parameters>：如果 Parameters = Schema.Struct({filePath: Schema.String})
  // 那么这里就是 { filePath: string }
  execute(args: Schema.Schema.Type<Parameters>): Promise<string>
}

// ─────────────────────────────────────────────────────────────
// 2. 类型推导：用泛型锁定每个工具的 execute 参数类型
// ─────────────────────────────────────────────────────────────

// 先定义一个工具的参数 Schema（单一来源）
const ReadParameters = Schema.Struct({
  filePath: Schema.String,
})

// 用泛型把 ReadParameters 传进 Tool：
// Tool<typeof ReadParameters> 展开后，execute 的 args 自动变成 { filePath: string }
const readTool: Tool<typeof ReadParameters> = {
  id: "read",
  description: "读取文件",
  parameters: ReadParameters,
  // args 的类型是 { filePath: string }，可以直接解构，不需要 as 断言
  async execute(args) {
    const { filePath } = args // 类型安全！编译器知道有 filePath 且是 string
    return `读取文件: ${filePath}`
  },
}

// 演示：正常调用
console.log("════════ 2. 类型推导：execute 的 args 是类型安全的 ════════\n")
console.log("readTool.execute({ filePath: 'src/read.ts' }) →")
console.log("  ", await readTool.execute({ filePath: "src/read.ts" }))
console.log("")

// ─────────────────────────────────────────────────────────────
// 3. 对比旧版：Record<string, unknown> 为什么"等于没约束"
// ─────────────────────────────────────────────────────────────
// 阶段 13 之前的写法：execute(args: Record<string, unknown>)
// Record<string, unknown> 表示"任意对象"——编译器不知道里面有什么字段，
// 于是写 args.wrongField、args.filePath 都不报错（类型都是 unknown）。
// 结果：手滑写错字段名，编译期完全不吭声，运行期拿到 undefined 才暴露。
console.log("════════ 3. 对比：旧版 Record 与泛型 Schema ════════\n")
console.log("旧版: execute(args: Record<string, unknown>)")
console.log("  写 args.filePath 不报错，写 args.filePth（拼错）也不报错")
console.log("  → 编译期零保护，全靠运行期踩坑\n")
console.log("泛型: execute(args: Schema.Schema.Type<typeof ReadParameters>)")
console.log("  编译器知道 args = { filePath: string }")
console.log("  → 写 args.filePth 编译直接报错：属性 'filePth' 不存在\n")

// ─────────────────────────────────────────────────────────────
// 4. 泛型 vs 不用泛型：为什么必须用泛型？
// ─────────────────────────────────────────────────────────────
// 如果不用泛型，interface 里写死：
//   interface ToolBad { parameters: Schema.Decoder<unknown>; execute(args: ???) }
//   execute 的 args 只能写成 Schema.Decoder<unknown> 的"Type"，
//   那 read 和 write 工具的 execute 参数就都是同一个宽泛类型——丢失每个工具自己的形状。
// 泛型让"每个 Tool 实例"携带"自己的参数类型"，这就是参数化的意义。

// 写两个不同参数的工具，证明泛型能区分：
const WriteParameters = Schema.Struct({
  filePath: Schema.String,
  content: Schema.String,
})

const writeTool: Tool<typeof WriteParameters> = {
  id: "write",
  description: "写文件",
  parameters: WriteParameters,
  async execute(args) {
    // args 类型是 { filePath: string; content: string }
    const { filePath, content } = args
    return `写入 ${filePath}（${content.length} 字符）`
  },
}

console.log("════════ 4. 泛型让不同工具携带各自的参数类型 ════════\n")
console.log("read 的 args:  { filePath: string }")
console.log("write 的 args: { filePath: string; content: string }")
console.log("→ 同一个 Tool 接口，两种不同的 execute 参数，都类型安全\n")
console.log("writeTool.execute({ filePath: 'out.txt', content: 'hi' }) →")
console.log("  ", await writeTool.execute({ filePath: "out.txt", content: "hi" }))
