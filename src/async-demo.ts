// src/async-demo.ts
// 1.3 课教学代码：async/await 演示
// 跑法：bun run src/async-demo.ts

// 模拟一个慢操作：等 2 秒后返回结果
// 返回 Promise<string>，意思是"将来给你一个 string"
function slowTask(): Promise<string> {
  return new Promise((resolve) => {
    setTimeout(() => resolve("慢操作完成"), 2000)
  })
}

// ─── 演示 1：不用 await ───
// 调了但没等，拿到的是 Promise 不是值
async function demo1() {
  console.log("=== 演示 1：不用 await ===")
  console.log("1. 开始")
  const result = slowTask() // 没加 await，拿到 Promise
  console.log("2. result =", result) // 打印 Promise { <pending> }
  console.log("3. 结束（没等 2 秒就结束了）")
}

// ─── 演示 2：用 await ───
// 等 2 秒，拿到真正的值
async function demo2() {
  console.log("\n=== 演示 2：用 await ===")
  console.log("1. 开始")
  const result = await slowTask() // await：等 2 秒，拿到真正的值
  console.log("2. result =", result) // 打印 "慢操作完成"
  console.log("3. 结束")
}

// ─── 演示 3：两次 await 串行 ───
async function demo3() {
  console.log("\n=== 演示 3：两次 await 串行 ===")
  console.log("1. 开始第一个任务")
  const r1 = await slowTask() // 等 2 秒
  console.log("2. 第一个完成:", r1)

  console.log("3. 开始第二个任务")
  const r2 = await slowTask() // 再等 2 秒
  console.log("4. 第二个完成:", r2)

  console.log("5. 总共等了 4 秒")
}

// 按顺序跑三个演示
async function main() {
  await demo1()
  await demo2()
  await demo3()
}

main()
