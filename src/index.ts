// src/index.ts
// 入口：CLI + 多轮对话 + 工具循环 + session 持久化
// 跑法：
//   bun run src/index.ts run              # 交互模式
//   bun run src/index.ts run "你好"       # 非交互模式（发一条消息，退出）
//   bun run src/index.ts run -c           # 恢复上次会话
//   bun run src/index.ts run -s ses_xxx   # 恢复指定 session
//
// 10.4 课重构：
// 1. 删掉了原来的 runToolLoop（和 agent-loop.ts 的 runAgentLoop 重复），
//    统一用 runAgentLoop，持久化通过 onMessage 回调注入
// 2. provider 和 tools 不再在这里创建，改成在入口用 Layer.mergeAll 组装，
//    runAgentLoop 从 Context 自取

import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import { Effect, Layer } from "effect"
import type { Message } from "./types"
import { ConfigService, configLayer } from "./service/config"
import { ProviderService, providerLayer } from "./service/provider"
import { ToolRegistry, toolRegistryLayer } from "./service/tool-registry"
import { runAgentLoop, type LoopCallbacks } from "./agent-loop"
import { createSession, listSessions, getSession } from "./session"
import { saveMessage, loadMessages } from "./message"
import { buildSystemPrompt } from "./system-context"
import { debug } from "./debug"

// ── 组装所有 Layer ─────────────────────────────────────────
// 注意 providerLayer 需要 ConfigService，所以要先用 Layer.provide 把 configLayer
// 喂给它，再 mergeAll。不能直接 mergeAll(三个)——mergeAll 的类型不会自动解析
// Layer 内部的依赖（providerLayer 的"需要 ConfigService"需求会残留）。
// 对照 opencode: core/src/tool/registry.ts 的 layer.pipe(Layer.provideMerge(registryLayer))
// （provideMerge 是 provide + merge 一步到位，我们这里拆开写更容易懂）
const appLayers = Layer.mergeAll(
  // providerLayer 的需求（ConfigService）由 configLayer 满足，结果：只提供 ProviderService
  providerLayer.pipe(Layer.provide(configLayer)),
  // toolRegistryLayer 没有依赖，直接合并
  toolRegistryLayer,
)

// ── 跑 agent loop 的公共函数 ───────────────────────────────
// messages + callbacks → 组装 Effect → provide 依赖 → runPromise
// 原来这段要传 provider、tools，现在依赖都在 Context 里，只需传业务参数
async function runLoop(messages: Message[], callbacks: LoopCallbacks): Promise<void> {
  await Effect.runPromise(
    runAgentLoop(messages, callbacks).pipe(Effect.provide(appLayers)),
  )
}

// ── CLI 定义 ──────────────────────────────────────────────
// 对照 opencode: packages/opencode/src/index.ts
// opencode 有 23 个命令，我们简化为 1 个 run 命令

yargs(hideBin(process.argv))
  .scriptName("opencode-from-scratch")
  // 全局选项：所有命令都能用 --debug
  // 对照 opencode: src/index.ts 的 .option("print-logs", ...) 等
  .option("debug", {
    alias: "d",
    type: "boolean",
    description: "启用调试日志",
    global: true,
  })
  // 中间件：在 handler 之前运行，做跨命令的通用处理
  // 对照 opencode: src/index.ts 的 .middleware（选项转环境变量）
  .middleware(async (args) => {
    if (args.debug) {
      process.env.DEBUG = "1"
    }
    process.env.AGENT = "1"
  })
  .command(
    "run [message..]",
    "运行 agent",
    (yargs) =>
      yargs
        .positional("message", { type: "string", array: true, default: [], describe: "非交互模式：发送一条消息后退出" })
        .option("continue", { alias: "c", type: "boolean", description: "恢复上次会话" })
        .option("session", { alias: "s", type: "string", description: "恢复指定 session ID" }),
    async (args) => {
      // 1. system prompt（不存数据库，每次启动重新生成）
      const systemPrompt: Message = {
        role: "system",
        content: buildSystemPrompt(),
      }

      // 2. 调试模式（VSCode Debug Console 不支持 stdin）
      const debugInputs = process.env.DEBUG_INPUTS
        ? (JSON.parse(process.env.DEBUG_INPUTS) as string[])
        : null

      // 3. 决定 session：--session > --continue > 新建/选择
      //    这段逻辑没变（session 还没服务化，是 11+ 阶段的活）
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

      // 4. 构造回调：CLI 版把事件打印到终端，同时持久化到数据库
      //    onMessage 就是 10.4 新增的钩子——每次 loop 加消息都存库
      const callbacks: LoopCallbacks = {
        // 流式文本：写到 stdout（带 "AI: " 前缀，和原来 runToolLoop 一致）
        onChunk(text) {
          process.stdout.write(text)
        },
        // 工具开始调用：打印一行
        onToolCall(id, name, args) {
          console.log(`  [调用工具] ${name}(${args})`)
        },
        // 工具执行完毕：打印结果摘要
        onToolResult(id, output) {
          debug(`工具结果 (${output.length} 字符):`)
          debug(output)
        },
        // 持久化：每次加消息都存库（原来是 runToolLoop 里手动 saveMessage）
        onMessage(msg) {
          void saveMessage(sessionId, msg)
        },
      }

      // 5. 非交互模式：发一条消息，退出
      if (args.message && args.message.length > 0) {
        const input = args.message.join(" ")
        const userMsg: Message = { role: "user", content: input }
        messages.push(userMsg)
        await saveMessage(sessionId, userMsg)
        console.log("AI: ")
        await runLoop(messages, callbacks)
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

        console.log("AI: ")
        await runLoop(messages, callbacks)
      }
    },
  )
  .demandCommand(1, "请指定命令，用 --help 查看可用命令")
  .strict()
  .help("help", "显示帮助")
  .alias("help", "h")
  .parse()
