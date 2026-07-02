// src/debug-target.ts
// 0.6 课教学代码：断点调试的目标文件
// 跑法：在 VSCode 里打开此文件，设断点后按 F5 调试

// 模拟一个"算成绩平均值"的逻辑，用于演示断点调试
function calculateAverage(scores: number[]): number {
  // reduce：把数组累加成一个值
  // acc 是累加器，s 是当前元素，0 是初始值
  // 类比 Python：sum(scores)
  const sum = scores.reduce((acc, s) => acc + s, 0)

  // ← 在这行设断点，能看到 sum 和 scores 的值
  const average = sum / scores.length

  return average
}

const scores = [85, 92, 78, 96, 88]

// 按 F5 调试，程序会进入 calculateAverage，在断点处暂停
const result = calculateAverage(scores)

console.log("平均分:", result)
