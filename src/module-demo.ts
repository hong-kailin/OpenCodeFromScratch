// src/module-demo.ts
// 0.3 课教学代码：演示 import（导入）
// 跑法：bun run src/module-demo.ts

// 从本地文件导入：./ 表示当前目录，花括号里是要导入的名字
import { add, multiply, type Operation } from "./math-utils"

// 演示使用导入的函数
const sumResult = add(10, 20)
const productResult = multiply(10, 20)

// 演示使用导入的类型
const op: Operation = "add"

console.log("=== 模块导入演示 ===")
console.log("add(10, 20):", sumResult)
console.log("multiply(10, 20):", productResult)
console.log("Operation:", op)
