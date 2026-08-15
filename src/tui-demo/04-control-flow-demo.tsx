// src/tui-demo/04-control-flow-demo.tsx
// 9.1 课教学代码：控制流组件 Show 和 For（渲染到终端）
// 对照文档：docs/09-tui/01-jsx-solidjs/04-control-flow.md
// 跑法：bun run src/tui-demo/04-control-flow-demo.tsx
//
// 看点：
// 1. <Show> 的 fallback：消息列表为空时显示「暂无消息」
// 2. <For> 增量更新：每 0.8 秒来一条新消息，旧消息原地不动（不重建）
// 3. memo 计算的消息数自动更新
// 程序 7 秒后自动退出

import { render } from "@opentui/solid"
import { createSignal, createMemo, Show, For } from "solid-js"

// 消息类型：角色 + 内容
interface Msg {
  role: "user" | "assistant" | "tool"
  content: string
}

function ChatDemo() {
  // 数据源：消息列表（初始为空）
  const [messages, setMessages] = createSignal<Msg[]>([])

  // 计算属性：消息数量、是否有消息
  const messageCount = createMemo(() => messages().length)
  const hasMessages = createMemo(() => messages().length > 0)

  // 脚本：模拟一次 agent 对话的消息流
  const script: Msg[] = [
    { role: "user", content: "帮我读一下 src/index.ts" },
    { role: "assistant", content: "好的，我来读取文件..." },
    { role: "tool", content: "[read] src/index.ts（241 行）" },
    { role: "assistant", content: "这个文件是 CLI 入口，用 yargs 定义命令..." },
    { role: "user", content: "谢谢！" },
  ]

  // 每 800ms 追加一条消息（模仿流式对话的过程）
  let index = 0
  const timer = setInterval(() => {
    if (index < script.length) {
      // 追加：保留旧数组元素 + 新元素（不可变更新）
      // <For> 只为「新的一条」创建元素，旧的几条原地不动
      setMessages([...messages(), script[index]!])
      index++
    } else {
      clearInterval(timer)
    }
  }, 800)

  return (
    <box flexDirection="column" padding={1}>
      <text>── 消息列表（For + Show 演示，每 0.8 秒来一条）──</text>

      {/* 条件渲染：有消息显示列表，没消息显示 fallback */}
      <Show when={hasMessages()} fallback={<text fg="gray">（暂无消息，稍等第一条...）</text>}>
        {/* 列表渲染：遍历 messages，每条消息一个带颜色的 text */}
        <For each={messages()}>
          {(msg) => (
            // 不同角色不同颜色：user 青色 / assistant 绿色 / tool 灰色
            <text fg={msg.role === "user" ? "cyan" : msg.role === "assistant" ? "green" : "gray"}>
              {"["}
              {msg.role}
              {"] "}
              {msg.content}
            </text>
          )}
        </For>
      </Show>

      {/* memo：数量自动更新（观察数字变化） */}
      <text fg="yellow">共 {messageCount()} 条消息</text>
    </box>
  )
}

render(() => <ChatDemo />)

// 演示完自动退出
setTimeout(() => process.exit(0), 7000)
