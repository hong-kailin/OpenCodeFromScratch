// src/tui-demo/03-signals-demo.ts
// 9.1 课教学代码：SolidJS 响应式三件套
// 对照文档：docs/09-tui/01-jsx-solidjs/03-solidjs-signals.md
// 跑法：bun run src/tui-demo/03-signals-demo.ts
//
// 纯 console 输出，不需要渲染（响应式和渲染是两回事）
// 核心观察点：memo 的计算次数计数器--证明"依赖没变就用缓存"

import { createSignal, createMemo, createEffect, createRoot } from "solid-js"

// 等一个 tick，让异步调度的 effect 跑完再往下走（输出顺序才稳定）
const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

async function main() {
  // ─── 1. createSignal：响应式变量 ─────────────────────────────

  console.log("=== 1. createSignal：响应式变量 ===\n")

  // createSignal(初始值) 返回 [读取函数, 设置函数]（TS 解构赋值）
  const [count, setCount] = createSignal(0)

  // 读取：count 是函数，要调用才有值
  console.log(`  count() = ${count()}`) // 0

  // 常见坑：忘了括号，拿到的是函数本身
  console.log(`  count（没加括号）= ${count}`) // [Function]

  // 设置：直接给新值
  setCount(5)
  console.log(`  setCount(5) 后 count() = ${count()}`) // 5

  // 设置：基于当前值计算（类似 count += 1）
  setCount((c) => c + 1)
  console.log(`  setCount(c => c + 1) 后 count() = ${count()}`) // 6

  await tick()

  // ─── 2. createMemo：计算属性（带缓存） ───────────────────────

  console.log("\n=== 2. createMemo：计算属性 ===\n")

  const [price, setPrice] = createSignal(100)

  // 计算次数计数器：观察 memo 到底算了几次
  let computeCount = 0

  // doubled 依赖 price：price 变了才重新计算，否则用缓存
  const doubled = createMemo(() => {
    computeCount++ // 每次真正计算时 +1
    return price() * 2
  })

  console.log(`  第一次读 doubled() = ${doubled()}`)
  console.log(`  >>> 计算次数: ${computeCount}`) // 1（第一次，必须算）

  console.log(`  再读一次 doubled() = ${doubled()}`)
  console.log(`  再读一次 doubled() = ${doubled()}`)
  console.log(`  >>> 计算次数: ${computeCount}`) // 还是 1！读多少次都用缓存

  console.log("  改 price = 500 ...")
  setPrice(500)
  console.log(`  读 doubled() = ${doubled()}`)
  console.log(`  >>> 计算次数: ${computeCount}`) // 2（依赖变了，重算一次）

  console.log(`  再读 doubled() = ${doubled()}`)
  console.log(`  >>> 计算次数: ${computeCount}`) // 还是 2，又用缓存了

  await tick()

  // ─── 3. createEffect：副作用 ─────────────────────────────────

  console.log("\n=== 3. createEffect：副作用 ===\n")

  // createEffect 接收一个函数，函数里读了哪些 signal 就依赖哪些
  createEffect(() => {
    console.log(`  [effect] count 现在是 ${count()}`)
  })

  console.log("  改 count = 10：")
  setCount(10)
  await tick() // effect 自动重新执行
  console.log("  [观察] 上面自动打印了 [effect] count 现在是 10")

  console.log("\n  改 count = 20：")
  setCount(20)
  await tick()
  console.log("  [观察] 又自动打印了 20 的那行")

  console.log("\n  再改 count = 20（值没变）：")
  setCount(20)
  await tick()
  console.log("  [观察] 没有新输出！值相同（20 -> 20），SolidJS 不触发更新")

  await tick()

  // ─── 4. 三件套联动 ───────────────────────────────────────────

  console.log("\n=== 4. 三件套联动（订单金额计算器） ===\n")

  const [quantity, setQuantity] = createSignal(2) // 数量
  const [unitPrice, setUnitPrice] = createSignal(100) // 单价

  // memo：总价 = 数量 × 单价（依赖两个 signal）
  const total = createMemo(() => quantity() * unitPrice())

  // effect：总价变了自动执行（这里用日志代替"存数据库"）
  createEffect(() => {
    console.log(`  [自动保存] 订单总额 ${total()} 元已写入数据库`)
  })
  await tick() // 初始执行一次

  console.log("\n  改数量 = 3：")
  setQuantity(3)
  await tick() // total 重算 -> effect 自动跑

  console.log("\n  改单价 = 200：")
  setUnitPrice(200)
  await tick()

  console.log("\n  数据流向：setQuantity -> total(memo 重算) -> effect(自动执行)")
  console.log("  全程没有一行「手动调用刷新」的代码")
}

createRoot(main)
