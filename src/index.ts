// src/index.ts
// 入口：多轮对话 + 工具循环（tool loop）
// 跑法：bun run src/index.ts

import type { Message } from "./types"
import { loadConfig, chatWithTools } from "./llm"
import { readTool } from "./tool/read"
import type { Tool } from "./tool/tool"

// 1. 读配置
const config = await loadConfig()

// 2. 注册工具：把所有可用工具放一个数组里
// 对照 opencode: 它用 ToolRegistry 管理，我们简化为数组
const tools: Tool[] = [readTool]

// 3. messages 历史
const messages: Message[] = [
  { role: "system", content: "你是一个简洁的助手，用中文回答。你可以使用 read 工具读取本地文件。" },
]

// ── 调试模式 ──────────────────────────────────────────────
const debugInputs = process.env.DEBUG_INPUTS
  ? (JSON.parse(process.env.DEBUG_INPUTS) as string[])
  : null
let debugIndex = 0

console.log("AI 助手已启动，输入问题开始对话（Ctrl+C 退出）")

// 4. 多轮对话循环
while (true) {
  const input = debugInputs ? debugInputs[debugIndex++] : prompt("你: ")
  if (!input) break

  messages.push({ role: "user", content: input })

  // ── tool loop ──────────────────────────────────────────
  // 这是 agent 的核心：LLM 调用工具 → 执行 → 喂回结果 → 继续调 LLM → 直到不再调用工具
  // 对照 opencode: session/prompt.ts 的 runLoop
  const MAX_STEPS = 20 // 防止无限循环

  let step = 0
  while (step < MAX_STEPS) {
    step++

    // 调 LLM（带 tools，流式输出文本）
    process.stdout.write("AI: ")
    const result = await chatWithTools(messages, config, tools, (text) => {
      process.stdout.write(text)
    })
    console.log()

    // 没有 tool_calls → LLM 说完了，结束循环
    if (result.toolCalls.length === 0) {
      messages.push({ role: "assistant", content: result.text })
      break
    }

    // 有 tool_calls → 把 assistant 消息（带 tool_calls）加入 messages
    // LLM 需要知道自己之前调了什么工具
    messages.push({
      role: "assistant",
      content: result.text || null,
      tool_calls: result.toolCalls,
    })

    // 执行每个工具，把结果以 role: "tool" 加入 messages
    for (const tc of result.toolCalls) {
      const tool = tools.find((t) => t.id === tc.function.name)
      if (!tool) {
        console.log(`  [错误] 找不到工具: ${tc.function.name}`)
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: `错误：找不到工具 ${tc.function.name}`,
        })
        continue
      }

      // 解析参数（arguments 是 JSON 字符串）
      const args = JSON.parse(tc.function.arguments)

      // 执行工具
      console.log(`  [调用工具] ${tc.function.name}(${tc.function.arguments})`)
      const output = await tool.execute(args)

      // 把结果喂回 LLM
      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: output,
      })
    }

    // 继续循环（回到调 LLM，这次 LLM 会看到工具结果）
  }

  if (step >= MAX_STEPS) {
    console.log("  [达到最大步数限制，停止循环]")
  }
}
