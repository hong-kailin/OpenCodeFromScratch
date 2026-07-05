// src/index.ts
// 入口：多轮对话 + 工具循环 + session 持久化
// 跑法：bun run src/index.ts
// 5.4 课改造：启动时选择新建/恢复 session，对话中自动保存消息到数据库
// 6.1 课改造：通过 Provider 接口调用 LLM，不再直接调 chatWithTools

import type { Message } from "./types"
import { loadConfig } from "./llm"
import { createOpenAIProvider } from "./provider/openai"
import type { Provider } from "./provider"
import { readTool } from "./tool/read"
import { writeTool } from "./tool/write"
import { editTool } from "./tool/edit"
import { bashTool } from "./tool/bash"
import { globTool } from "./tool/glob"
import { grepTool } from "./tool/grep"
import { truncate } from "./tool/truncate"
import type { Tool } from "./tool/tool"
import { createSession, listSessions } from "./session"
import { saveMessage, loadMessages } from "./message"

// 1. 读配置 + 创建 Provider
// 对照 opencode: 它根据 provider 配置创建对应的 Route，我们简化为只支持 OpenAI 兼容
const config = await loadConfig()
const provider: Provider = createOpenAIProvider(config)

// 2. 注册工具：把所有可用工具放一个数组里
// 对照 opencode: 它用 ToolRegistry 管理，我们简化为数组
const tools: Tool[] = [readTool, writeTool, editTool, bashTool, globTool, grepTool]

// 3. system prompt（不存数据库，每次启动重新生成）
// 对照 opencode: system prompt 由 system-context 模块组装（阶段 7 会实现）
const systemPrompt: Message = {
  role: "system",
  content: "你是一个简洁的助手，用中文回答。你可以使用 read、write、edit、bash、glob、grep 工具读取、写入、编辑文件、执行命令和搜索代码。",
}

// ── 调试模式 ──────────────────────────────────────────────
// VSCode Debug Console 不支持 stdin，用 DEBUG_INPUTS 预设输入
const debugInputs = process.env.DEBUG_INPUTS
  ? (JSON.parse(process.env.DEBUG_INPUTS) as string[])
  : null
let debugIndex = 0

// 4. 启动时选择：新建 session 还是恢复已有
// 对照 opencode: 它的 session 管理有多层（project、workspace、parent）
// 我们简化为：列出所有 session，用户选一个，或新建
let sessionId: string
let messages: Message[]

if (debugInputs) {
  // 调试模式：自动新建 session，不交互
  const session = await createSession()
  sessionId = session.id
  messages = [systemPrompt]
  console.log(`AI 助手已启动（调试模式）→ 新建会话: ${session.title}`)
} else {
  // 交互模式：列出已有 session，让用户选
  const sessions = await listSessions()

  if (sessions.length > 0) {
    console.log("AI 助手已启动\n")
    console.log("已有会话：")
    for (let i = 0; i < sessions.length; i++) {
      const s = sessions[i]!
      const time = new Date(s.time_updated).toLocaleString("zh-CN")
      console.log(`  [${i}] ${s.title}  (${time})`)
    }
    console.log(`  [${sessions.length}] 新建会话`)

    const choice = prompt("\n请选择: ")
    const choiceNum = choice ? parseInt(choice) : NaN

    if (isNaN(choiceNum) || choiceNum === sessions.length) {
      // 新建会话
      const session = await createSession()
      sessionId = session.id
      messages = [systemPrompt]
      console.log(`\n已新建会话: ${session.title}`)
    } else if (choiceNum >= 0 && choiceNum < sessions.length) {
      // 恢复已有会话
      const selected = sessions[choiceNum]!
      sessionId = selected.id
      // 从数据库加载历史消息，前面拼上 system prompt
      // system prompt 不存数据库——每次启动重新生成（内容可能变）
      const history = await loadMessages(sessionId)
      messages = [systemPrompt, ...history]
      console.log(`\n已恢复会话: ${selected.title} (${history.length} 条历史消息)`)
    } else {
      console.log("无效选择，退出")
      process.exit(1)
    }
  } else {
    // 没有历史会话，直接新建
    const session = await createSession()
    sessionId = session.id
    messages = [systemPrompt]
    console.log(`AI 助手已启动 → 新建会话: ${session.title}`)
  }
}

console.log("\n输入问题开始对话（Ctrl+C 退出）\n")

// 5. 多轮对话循环
while (true) {
  const input = debugInputs ? debugInputs[debugIndex++] : prompt("你: ")
  if (!input) break

  // 用户消息：加入内存 + 存数据库
  const userMsg: Message = { role: "user", content: input }
  messages.push(userMsg)
  await saveMessage(sessionId, userMsg)

  // ── tool loop ──────────────────────────────────────────
  // 这是 agent 的核心：LLM 调用工具 → 执行 → 喂回结果 → 继续调 LLM → 直到不再调用工具
  // 对照 opencode: session/prompt.ts 的 runLoop
  const MAX_STEPS = 20 // 防止无限循环

  let step = 0
  while (step < MAX_STEPS) {
    step++

    // 调 LLM（带 tools，流式输出文本）——通过 Provider 接口调用
    process.stdout.write("AI: ")
    const result = await provider.chatWithTools(messages, tools, (text) => {
      process.stdout.write(text)
    })
    console.log()

    // 没有 tool_calls → LLM 说完了，结束循环
    if (result.toolCalls.length === 0) {
      const assistantMsg: Message = { role: "assistant", content: result.text }
      messages.push(assistantMsg)
      await saveMessage(sessionId, assistantMsg)
      break
    }

    // 有 tool_calls → 把 assistant 消息（带 tool_calls）加入 messages
    // LLM 需要知道自己之前调了什么工具
    const assistantMsg: Message = {
      role: "assistant",
      content: result.text || null,
      tool_calls: result.toolCalls,
    }
    messages.push(assistantMsg)
    await saveMessage(sessionId, assistantMsg)

    // 执行每个工具，把结果以 role: "tool" 加入 messages
    for (const tc of result.toolCalls) {
      const tool = tools.find((t) => t.id === tc.function.name)
      if (!tool) {
        console.log(`  [错误] 找不到工具: ${tc.function.name}`)
        const errorMsg: Message = {
          role: "tool",
          tool_call_id: tc.id,
          content: `错误：找不到工具 ${tc.function.name}`,
        }
        messages.push(errorMsg)
        await saveMessage(sessionId, errorMsg)
        continue
      }

      // 解析参数（arguments 是 JSON 字符串）
      const args = JSON.parse(tc.function.arguments)

      // 执行工具
      console.log(`  [调用工具] ${tc.function.name}(${tc.function.arguments})`)
      const output = await tool.execute(args)

      // 把结果喂回 LLM
      const toolMsg: Message = {
        role: "tool",
        tool_call_id: tc.id,
        content: truncate(output),
      }
      messages.push(toolMsg)
      await saveMessage(sessionId, toolMsg)
    }

    // 继续循环（回到调 LLM，这次 LLM 会看到工具结果）
  }

  if (step >= MAX_STEPS) {
    console.log("  [达到最大步数限制，停止循环]")
  }
}
