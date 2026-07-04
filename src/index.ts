// src/index.ts
// 入口：多轮对话循环（流式版）
// 跑法：bun run src/index.ts

import type { Message } from "./types"
import { loadConfig, chatStream } from "./llm"

// 1. 读配置
const config = await loadConfig()

// 2. messages 历史：从 system prompt 开始，每轮追加 user 和 assistant 消息
const messages: Message[] = [
  { role: "system", content: "你是一个简洁的助手，用中文回答" },
]

// ── 调试模式 ──────────────────────────────────────────────
// 问题：VS Code 的 Bun 调试器在 Debug Console 里运行程序，
//       Debug Console 没有 stdin，prompt() 会直接返回 null 导致程序立刻退出。
//
// 解决：检查 DEBUG_INPUTS 环境变量。如果设了，就从它里面取输入，
//       不再调用 prompt()。这样在 VS Code 里也能正常断点调试。
//
// 用法：在 .vscode/launch.json 的 "调试（预设输入）" 配置里设置 env：
//       "env": { "DEBUG_INPUTS": "[\"你好\", \"1+1等于几\", \"退出\"]" }
//       这是一个 JSON 字符串数组，程序会按顺序逐条当作用户输入。
const debugInputs = process.env.DEBUG_INPUTS
  ? (JSON.parse(process.env.DEBUG_INPUTS) as string[])
  : null
let debugIndex = 0

console.log("AI 助手已启动，输入问题开始对话（Ctrl+C 退出）")

// 3. 多轮对话循环
while (true) {
  // 调试模式：从预设数组取输入；正常模式：从终端读
  const input = debugInputs ? debugInputs[debugIndex++] : prompt("你: ")
  if (!input) break // 预设用完或用户取消，退出

  // 把用户输入加入历史
  messages.push({ role: "user", content: input })

  // 流式调 API（带上全部历史，AI 才能"记住"之前说过什么）
  // 和阶段 1 的区别：用 chatStream 代替 chat，逐字打印
  process.stdout.write("AI: ") // 先打印前缀（不换行）
  const reply = await chatStream(messages, config, (text) => {
    // 回调函数：每收到一段文本就立刻打印（不换行，打字机效果）
    process.stdout.write(text)
  })
  console.log() // 回复结束，换行

  // 把 AI 回复加入历史（下次请求带上，AI 才能"记住"之前说过什么）
  messages.push({ role: "assistant", content: reply })
}
