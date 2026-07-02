// src/type-demo.ts
// 0.2 课教学代码：TypeScript 类型系统示例
// 跑法：bun run src/type-demo.ts

// ─── 1. 基本类型标注 ───
const toolName: string = "opencode"
const version: number = 1
const isReady: boolean = true
const files: string[] = ["read", "write", "edit"]

console.log("=== 基本类型 ===")
console.log("toolName:", toolName)
console.log("version:", version)
console.log("isReady:", isReady)
console.log("files:", files)

// ─── 2. 函数类型 ───
// 普通函数：参数和返回值都标注
function average(a: number, b: number): number {
  return (a + b) / 2
}

// 箭头函数（opencode 更常见这种写法）
const greet = (target: string): string => `hello ${target}`

console.log("\n=== 函数类型 ===")
console.log("average(10, 20):", average(10, 20))
console.log("greet('opencode'):", greet("opencode"))

// ─── 3. union 联合类型 ───
function format(value: string | number): string {
  return String(value)
}

// 字面量联合：只能取这几个值之一
type AgentMode = "build" | "plan" | "general"
const mode: AgentMode = "build"

console.log("\n=== union 类型 ===")
console.log("format('text'):", format("text"))
console.log("format(42):", format(42))
console.log("AgentMode:", mode)

// ─── 4. interface：描述对象形状 ───
interface Tool {
  id: string
  description: string
  execute: (input: string) => string
}

const readTool: Tool = {
  id: "read",
  description: "读取文件",
  execute: (path) => `文件内容: ${path}`,
}

console.log("\n=== interface ===")
console.log("Tool:", readTool.id, "-", readTool.description)
console.log("execute('a.txt'):", readTool.execute("a.txt"))

// ─── 5. type：和 interface 类似，但还能做 union ───
type ToolRecord = Record<string, Tool>

const toolRegistry: ToolRecord = {
  read: readTool,
}

console.log("\n=== type + Record ===")
console.log("toolRegistry keys:", Object.keys(toolRegistry))

// ─── 6. 泛型 ───
function identity<T>(value: T): T {
  return value
}

const numResult = identity<number>(5)
const strResult = identity<string>("hello")

console.log("\n=== 泛型 ===")
console.log("identity<number>(5):", numResult)
console.log("identity<string>('hello'):", strResult)
