// src/debug.ts
// 调试日志工具
// --debug 开启时（中间件设 process.env.DEBUG = "1"），debug() 才会输出
// 对照 opencode: 它用 Effect 的日志系统，带 logLevel 过滤；我们简化为环境变量开关

import type { Message } from "@opencode-from-scratch/schema"

// 基础调试输出：只在 --debug 模式下打印
// 用法：debug("step", 1) 或 debug("API 请求", url)
export function debug(...args: unknown[]) {
  if (process.env.DEBUG) {
    console.log("[debug]", ...args)
  }
}

// 格式化消息数组，方便查看发给 LLM 的完整上下文
// 不打印全部内容（可能很长），打印 role + 内容摘要 + tool_calls 信息
export function debugMessages(messages: Message[]) {
  if (!process.env.DEBUG) return
  console.log("[debug] ── 发送给 LLM 的 messages ──────────────")
  messages.forEach((msg, i) => {
    const content = msg.content || ""
    // 内容摘要：超过 80 字符就截断，显示总长度
    const summary =
      content.length > 80
        ? content.slice(0, 80) + `...（共 ${content.length} 字符）`
        : content
    let line = `[debug]   [${i}] ${msg.role}: ${summary}`

    // assistant 消息可能带 tool_calls
    if (msg.tool_calls) {
      const names = msg.tool_calls
        .map((tc) => `${tc.function.name}(${tc.function.arguments})`)
        .join(", ")
      line += `\n[debug]       tool_calls: ${names}`
    }

    // tool 消息带 tool_call_id（对应哪个工具调用）
    if (msg.tool_call_id) {
      line += `\n[debug]       tool_call_id: ${msg.tool_call_id}`
    }

    console.log(line)
  })
  console.log(`[debug] ── 共 ${messages.length} 条消息 ──────────────`)
}
