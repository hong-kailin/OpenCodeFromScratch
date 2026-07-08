// src/tui/hello.tsx
// 9.2 课教学代码：第一个 opentui TUI 程序
// 跑法：bun run src/tui/hello.tsx

import { render } from "@opentui/solid"
import { createSignal } from "solid-js"

function App() {
  const [count, setCount] = createSignal(0)

  setInterval(() => setCount((c) => c + 1), 1000)

  return (
    <box flexDirection="column" padding={1}>
      <text fg="green">opentui 计数器</text>
      <text fg="cyan">计数: {count()}</text>
    </box>
  )
}

render(() => <App />)