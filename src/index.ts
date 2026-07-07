// src/index.ts
// 入口：CLI + 多轮对话 + 工具循环 + session 持久化
// 跑法：
//   bun run src/index.ts run              # 交互模式
//   bun run src/index.ts run "你好"       # 非交互模式（发一条消息，退出）
//   bun run src/index.ts run -c           # 恢复上次会话
//   bun run src/index.ts run -s ses_xxx   # 恢复指定 session

import yargs from "yargs"
import { hideBin } from "yargs/helpers"
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
import { createSession, listSessions, getSession } from "./session"
import { saveMessage, loadMessages } from "./message"
import { buildSystemPrompt } from "./system-context"

// ── 工具循环 ──────────────────────────────────────────────
// agent 的核心：LLM 调用工具 → 执行 → 喂回结果 → 继续调 LLM → 直到不再调用工具
// 对照 opencode: session/prompt.ts 的 runLoop
async function runToolLoop(
  messages: Message[],
  sessionId: string,
  provider: Provider,
  tools: Tool[],
): Promise<void> {
  const MAX_STEPS = 20 // 防止无限循环

  let step = 0
  while (step < MAX_STEPS) {
    step++

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

      const args = JSON.parse(tc.function.arguments)
      console.log(`  [调用工具] ${tc.function.name}(${tc.function.arguments})`)
      const output = await tool.execute(args)

      const toolMsg: Message = {
        role: "tool",
        tool_call_id: tc.id,
        content: truncate(output),
      }
      messages.push(toolMsg)
      await saveMessage(sessionId, toolMsg)
    }
  }

  if (step >= MAX_STEPS) {
    console.log("  [达到最大步数限制，停止循环]")
  }
}

// ── CLI 定义 ──────────────────────────────────────────────
// 对照 opencode: packages/opencode/src/index.ts
// opencode 有 23 个命令，我们简化为 1 个 run 命令

yargs(hideBin(process.argv))
  .scriptName("opencode-from-scratch")
  .command(
    "run [message..]",
    "运行 agent",
    (yargs) =>
      yargs
        .positional("message", { type: "string", array: true, default: [], describe: "非交互模式：发送一条消息后退出" })
        .option("continue", { alias: "c", type: "boolean", description: "恢复上次会话" })
        .option("session", { alias: "s", type: "string", description: "恢复指定 session ID" }),
    async (args) => {
      // 1. 读配置 + 创建 Provider + 注册工具
      const config = await loadConfig()
      const provider: Provider = createOpenAIProvider(config)
      const tools: Tool[] = [readTool, writeTool, editTool, bashTool, globTool, grepTool]

      // 2. system prompt（不存数据库，每次启动重新生成）
      const systemPrompt: Message = {
        role: "system",
        content: buildSystemPrompt(),
      }

      // 3. 调试模式（VSCode Debug Console 不支持 stdin）
      const debugInputs = process.env.DEBUG_INPUTS
        ? (JSON.parse(process.env.DEBUG_INPUTS) as string[])
        : null

      // 4. 决定 session：--session > --continue > 新建/选择
      let sessionId: string
      let messages: Message[]

      if (args.session) {
        // --session <id>：恢复指定 session
        const session = await getSession(args.session)
        if (!session) {
          console.log(`找不到 session: ${args.session}`)
          process.exit(1)
        }
        sessionId = session.id
        const history = await loadMessages(sessionId)
        messages = [systemPrompt, ...history]
        console.log(`已恢复会话: ${session.title} (${history.length} 条历史消息)`)
      } else if (args.continue) {
        // --continue：恢复最近更新的 session
        const sessions = await listSessions()
        if (sessions.length === 0) {
          console.log("没有历史会话，新建一个")
          const session = await createSession()
          sessionId = session.id
          messages = [systemPrompt]
        } else {
          const latest = sessions[0]! // listSessions 按 time_updated 倒序
          sessionId = latest.id
          const history = await loadMessages(sessionId)
          messages = [systemPrompt, ...history]
          console.log(`已恢复会话: ${latest.title} (${history.length} 条历史消息)`)
        }
      } else if (debugInputs) {
        // 调试模式：自动新建 session
        const session = await createSession()
        sessionId = session.id
        messages = [systemPrompt]
        console.log(`AI 助手已启动（调试模式）→ 新建会话: ${session.title}`)
      } else if (args.message && args.message.length > 0) {
        // 非交互模式：有 message → 新建 session
        const session = await createSession()
        sessionId = session.id
        messages = [systemPrompt]
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
            const session = await createSession()
            sessionId = session.id
            messages = [systemPrompt]
            console.log(`\n已新建会话: ${session.title}`)
          } else if (choiceNum >= 0 && choiceNum < sessions.length) {
            const selected = sessions[choiceNum]!
            sessionId = selected.id
            const history = await loadMessages(sessionId)
            messages = [systemPrompt, ...history]
            console.log(`\n已恢复会话: ${selected.title} (${history.length} 条历史消息)`)
          } else {
            console.log("无效选择，退出")
            process.exit(1)
          }
        } else {
          const session = await createSession()
          sessionId = session.id
          messages = [systemPrompt]
          console.log(`AI 助手已启动 → 新建会话: ${session.title}`)
        }
      }

      // 5. 非交互模式：发一条消息，退出
      if (args.message && args.message.length > 0) {
        const input = args.message.join(" ")
        const userMsg: Message = { role: "user", content: input }
        messages.push(userMsg)
        await saveMessage(sessionId, userMsg)
        await runToolLoop(messages, sessionId, provider, tools)
        return
      }

      // 6. 交互模式：while 循环
      console.log("\n输入问题开始对话（Ctrl+C 退出）\n")

      let debugIndex = 0
      while (true) {
        const input = debugInputs ? debugInputs[debugIndex++] : prompt("你: ")
        if (!input) break

        const userMsg: Message = { role: "user", content: input }
        messages.push(userMsg)
        await saveMessage(sessionId, userMsg)

        await runToolLoop(messages, sessionId, provider, tools)
      }
    },
  )
  .demandCommand(1, "请指定命令，用 --help 查看可用命令")
  .strict()
  .help("help", "显示帮助")
  .alias("help", "h")
  .parse()
