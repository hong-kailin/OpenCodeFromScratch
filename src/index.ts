// src/index.ts
// 入口：读配置 → 组装 messages → 调 API → 打印回复
// 跑法：bun run src/index.ts

import type { Message } from "./types"
import { loadConfig, chat } from "./llm"

// 1. 读配置
const config = await loadConfig()

// 2. 组装 messages（类比上一课 curl 里的 messages 数组）
const messages: Message[] = [
  { role: "system", content: "你是一个简洁的助手，用中文回答" },
  { role: "user", content: "什么是闭包？一句话解释" },
]

// 3. 调 API，拿到回复
const reply = await chat(messages, config)

// 4. 打印回复
console.log(reply)
