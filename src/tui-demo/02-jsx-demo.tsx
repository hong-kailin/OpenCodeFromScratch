// src/tui-demo/02-jsx-demo.tsx
// 9.1 课教学代码：JSX 6 条规则实战（渲染到终端）
// 对照文档：docs/09-tui/01-jsx-solidjs/02-jsx-basics.md
// 跑法：bun run src/tui-demo/02-jsx-demo.tsx
//
// 注意：render() 把组件挂载到终端，细节 9.2 课讲，这里先用起来
// 程序 5 秒后自动退出

import { render } from "@opentui/solid"
import { createSignal } from "solid-js"

// ── 规则 1：大写开头 = 自定义组件 ──────────────────────────────
// Greeting 是我们自己写的函数组件
// props 是使用组件时传进来的属性（这里只有一个 name: string）
function Greeting(props: { name: string }) {
  // 普通变量（非响应式），JSX 里直接用
  const icon = ">>"

  return (
    // 规则 6：一个组件只返回一个根标签（这里是 box）
    // 规则 2：flexDirection="column" 字符串属性用引号；padding={1} 表达式属性用花括号
    <box border padding={1}>
      {/* 规则 4：{} 里放 TypeScript 表达式：变量、运算、三元都行 */}
      {/* 文字颜色用 fg 属性（foreground），不是 color！这是 opentui 的命名 */}
      <text fg="green">{icon} 你好，{props.name}！</text>
      <text>1 + 1 = {1 + 1}</text>
      <text>名字长度：{props.name.length > 2 ? "挺长" : "很短"}</text>
    </box>
  )
}

function App() {
  // 表达式属性的进阶用法：{} 里放 signal（响应式，03 课细讲）
  // highlight 变化 -> 文字颜色和内容自动更新
  const [highlight, setHighlight] = createSignal(false)
  setTimeout(() => setHighlight(true), 2000)

  return (
    // 规则 3：标签可以嵌套，形成树状结构
    <box flexDirection="column" padding={1}>
      {/* 规则 1（另一半）：Greeting 大写是组件；box/text 小写是内置元素 */}
      <Greeting name="世界" />

      {/* 规则 2：fg={表达式}，值会随 highlight 变化 */}
      <box border padding={1}>
        <text fg={highlight() ? "green" : "white"}>
          {highlight() ? "2 秒到了：signal 变了 -> UI 自动更新（没调任何 render）" : "等 2 秒，这段字会自动变绿..."}
        </text>
      </box>

      <box flexDirection="row">
        <text fg="cyan">同一行 </text>
        <text fg="magenta">不同颜色 </text>
        <text fg="yellow">{new Date().toLocaleTimeString()}</text>
      </box>
    </box>
  )
}

render(() => <App />)

// 演示完自动退出（真实 TUI 不会这么做，这里方便反复运行观察）
setTimeout(() => process.exit(0), 5000)
