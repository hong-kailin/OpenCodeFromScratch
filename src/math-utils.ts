// src/math-utils.ts
// 0.3 课教学代码：演示 export（导出）
// 这个文件定义函数，导出给别的文件用

// 命名导出：加 export 关键字，别的文件就能 import 它
export function add(a: number, b: number): number {
  return a + b
}

export function multiply(a: number, b: number): number {
  return a * b
}

// 也可以导出类型
export type Operation = "add" | "multiply"

// 没有 export 的函数是模块私有的，外部访问不到
function secretHelper(): string {
  return "this is private"
}
