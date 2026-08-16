// src/tui-demo/01-reactive-demo.ts
// 9.1 课教学代码：命令式 vs 响应式对比
// 对照文档：docs/09-tui/01-jsx-solidjs/01-what-is-reactive.md
// 跑法：bun run src/tui-demo/01-reactive-demo.ts
//
// 本文件用 console.log 模拟"屏幕显示"，不需要任何 UI 框架
// 唯一用到的 solid-js API：createSignal / createEffect（03 课细讲，这里先当黑盒用）

import { createSignal, createEffect, createRoot } from "solid-js"

// 等一个事件循环 tick，让 SolidJS 的 effect 有机会执行
// （effect 的执行是异步调度的，await 一个 setTimeout(0) 保证它跑完再往下走）
const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

// ─── 演示 1：命令式 -- 数据变了，手动更新显示 ───────────────────
// 模拟聊天界面：消息列表 + 状态栏（未读数）
// 痛点：每个改数据的地方都要记得手动调"刷新显示"，漏一处界面就不一致

async function imperativeDemo() {
  console.log("=== 演示 1：命令式（手动更新显示） ===\n")

  // "数据"：普通变量
  let messages: string[] = []
  let unread = 0
  let displayedUnread = -1 // 屏幕"上"显示的值（只有调 renderStatusBar 才更新）

  // "显示"：两个手动刷新函数
  function renderMessageList() {
    console.log(`  [消息列表显示] ${messages.length} 条：${messages.join(" | ")}`)
  }
  function renderStatusBar() {
    displayedUnread = unread
    console.log(`  [状态栏显示]   未读 ${displayedUnread}`)
  }

  console.log("第 1 条消息来了：")
  messages.push("你好")
  unread++
  renderMessageList() // 必须手动调
  renderStatusBar() // 必须手动调

  console.log("\n第 2 条消息来了：")
  messages.push("你好！")
  unread++
  renderMessageList() // 又要手动调一遍...
  renderStatusBar()

  console.log("\n第 3 条消息来了（开发者忘了调 renderStatusBar）：")
  messages.push("再见")
  unread++
  renderMessageList() // 只更新了消息列表...
  // 没调 renderStatusBar()！屏幕显示过时数据：
  console.log(`  ← bug！状态栏还显示"未读 ${displayedUnread}"，真实值已经是 ${unread}`)
  console.log("  命令式的痛点：改数据的地方越多，越容易漏调刷新函数")
}

// ─── 演示 2：响应式 -- 声明关系，数据变了自动更新 ─────────────────
// 同样的场景，用 signal + effect 重写
// 关键区别：没有任何手动"render"调用！

async function reactiveDemo() {
  console.log("\n=== 演示 2：响应式（声明关系，自动更新） ===\n")

  // 数据源：signal（可以理解为"被追踪的变量"）
  const [unread, setUnread] = createSignal(0)
  const [messages, setMessages] = createSignal<string[]>([])

  // 声明"显示关系"：effect 函数里读了哪些 signal，SolidJS 就自动追踪哪些
  // unread 或 messages 变了 -> 这两行"显示"自动重新执行
  createEffect(() => {
    console.log(`  [状态栏显示]   未读 ${unread()}`)
  })
  createEffect(() => {
    console.log(`  [消息列表显示] ${messages().length} 条：${messages().join(" | ")}`)
  })

  console.log("（effect 声明时会先立即执行一次，输出上面两行）")
  await tick()

  console.log("\n第 1 条消息来了（只有 set，没有任何 render 调用）：")
  setUnread(1)
  setMessages([...messages(), "你好"])
  await tick() // 两行"显示"自动更新了

  console.log("\n第 2 条消息来了（还是只有 set）：")
  setUnread(2)
  setMessages([...messages(), "你好！"])
  await tick()

  console.log("\n第 3 条消息来了：")
  setUnread(3)
  setMessages([...messages(), "再见"])
  await tick()

  console.log("\n  注意：不可能出现演示 1 的 bug--没有「手动刷新」这回事，")
  console.log("  声明一次关系，之后数据怎么变，显示都自动跟上")
}

// ─── 演示 3：Excel 类比 -- C1 = A1 + B1 ────────────────────────

async function excelDemo() {
  console.log("\n=== 演示 3：Excel 类比 C1 = A1 + B1 ===\n")

  const [a1, setA1] = createSignal(5) // Excel 的 A1 单元格
  const [b1, setB1] = createSignal(10) // Excel 的 B1 单元格

  // C1 = A1 + B1：用 effect 声明"C1 依赖 A1 和 B1"
  // 改 A1 或 B1，C1 的"显示"自动重算，没人手动调
  createEffect(() => {
    console.log(`  A1=${a1()} B1=${b1()} -> C1=${a1() + b1()}`)
  })
  await tick()

  console.log("改 A1 = 100：")
  setA1(100) // C1 自动变 110
  await tick()

  console.log("改 B1 = -30：")
  setB1(-30) // C1 自动变 70
  await tick()

  console.log("\n  这就是响应式的核心：你声明关系（C1 = A1 + B1），")
  console.log("  框架负责追踪依赖和重新计算（Excel 帮你算 C1）")
}

// createRoot：SolidJS 的"响应式作用域"，demo 脚本包一层是标准做法
// （不包也能跑，但控制台会有警告；作用域细节不用现在关心）
createRoot(async () => {
  await imperativeDemo()
  await reactiveDemo()
  await excelDemo()
})
