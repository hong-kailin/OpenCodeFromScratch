// src/index.ts
// 入口：多轮对话循环
// 跑法：bun run src/index.ts

import type { Message } from "./types"
import { loadConfig, chat } from "./llm"

// 1. 读配置
const config = await loadConfig()

// 2. messages 历史：从 system prompt 开始，每轮追加 user 和 assistant 消息
const messages: Message[] = [
  { role: "system", content: "你是一个简洁的助手，用中文回答" },
]

console.log("AI 助手已启动，输入问题开始对话（Ctrl+C 退出）")

// 3. 多轮对话循环
while (true) {
  const input = prompt("你: ")
  if (!input) break // 用户取消或空输入，退出

  // 把用户输入加入历史
  messages.push({ role: "user", content: input })

  // 调 API（带上全部历史，AI 才能"记住"之前说过什么）
  const reply = await chat(messages, config)

  // 把 AI 回复加入历史（下次请求带上）
  messages.push({ role: "assistant", content: reply })

  console.log("AI:", reply)
}
