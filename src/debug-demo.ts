// src/debug-demo.ts
// 演示用 console.log 打点调试

// 假设我们有一个函数，算两个数的平均值，但结果不对
function average(a: number, b: number): number {
  const sum = a + b
  // 打印中间变量，看 sum 是不是对的
  console.log("debug: sum =", sum)
  const result = sum / 2
  // 打印最终结果
  console.log("debug: result =", result)
  return result
}

const answer = average(10, 20)
console.log("最终答案:", answer)
