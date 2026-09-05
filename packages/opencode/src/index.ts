// src/index.ts
// 阶段 12 教学代码：CLI 入口——用 Effect 组装 Layer，跑 agent loop
// 跑法：
//   bun run src/index.ts run              # 交互模式
//   bun run src/index.ts run "你好"       # 非交互模式
//   bun run src/index.ts run -c           # 恢复上次会话
//   bun run src/index.ts run -s ses_xxx   # 恢复指定 session
//
// 重构前（阶段 9）：
//   const config = await loadConfig()
//   const provider = createOpenAIProvider(config)
//   const tools = [readTool, writeTool, ...]
//   await runToolLoop(messages, sessionId, provider, tools)
//
// 重构后（阶段 12）：
//   provider 和 tools 从 Context 自取，只在入口组装一次 Layer
//   runAgentLoop 签名变短：(messages, callbacks) 不再传 provider/tools
//
// 阶段 16.6 改动：上层接入 core 包的全部服务
//   之前：直接调用模块级函数（createSession()、buildSystemPrompt() 等）
//   现在：yield* SessionStore / yield* SystemContext——从 Context 取服务
//   index.ts 瘦身：不再 import 具体函数，只 import 服务 tag 和 Layer

import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import { Effect, Layer } from "effect"
import type { Message } from "@opencode-from-scratch/schema"
import {
  debug,
  debugMessages,
  configLayer,
  providerLayer,
  toolRegistryLayer,
  fileSystemLayer,
  databaseLayer,
  sessionStoreLayer,
  systemContextLayer,
  SessionStore,
  SystemContext,
} from "@opencode-from-scratch/core"
import { runAgentLoop } from "./agent-loop"

// ── Layer 组装 ──────────────────────────────────────────────
// providerLayer 依赖 ConfigService，所以要先喂给它
// fileSystemLayer 工具 execute 需要；databaseLayer + sessionStoreLayer 存储需要
// systemContextLayer 组装 system prompt 需要
// 依赖链：databaseLayer → sessionStoreLayer；configLayer → providerLayer
const satisfiedProvider = providerLayer.pipe(Layer.provide(configLayer))
const satisfiedSessionStore = sessionStoreLayer.pipe(Layer.provide(databaseLayer))
const appLayers = Layer.mergeAll(
  configLayer,
  satisfiedProvider,
  toolRegistryLayer,
  fileSystemLayer,
  satisfiedSessionStore,
  systemContextLayer,
)

// ── CLI 定义 ──────────────────────────────────────────────

yargs(hideBin(process.argv))
  .scriptName("opencode-from-scratch")
  .option("debug", {
    alias: "d",
    type: "boolean",
    description: "启用调试日志",
    global: true,
  })
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
    (args) => {
      // 整个 handler 变成一个 Effect：所有依赖从 Context 自取
      // 16.6 关键改动：不再调模块级函数，改为 yield* 服务
      const program = Effect.fn("runCommand")(function* () {
        // 从 Context 取存储服务（16.5）+ SystemContext 服务（16.6）
        const store = yield* SessionStore
        const sysCtx = yield* SystemContext

        // 1. system prompt（不存数据库，每次启动重新生成）
        const systemPromptContent = yield* sysCtx.build()
        const systemPrompt: Message = {
          role: "system",
          content: systemPromptContent,
        }

        // 2. 调试模式（VSCode Debug Console 不支持 stdin）
        const debugInputs = process.env.DEBUG_INPUTS
          ? (JSON.parse(process.env.DEBUG_INPUTS) as string[])
          : null

        // 3. 决定 session（全部走 SessionStore 服务）
        let sessionId: string
        let messages: Message[]

        if (args.session) {
          const session = yield* store.get(args.session)
          if (!session) {
            console.log(`找不到 session: ${args.session}`)
            process.exit(1)
          }
          sessionId = session.id
          const history = yield* store.loadMessages(sessionId)
          messages = [systemPrompt, ...history]
          console.log(`已恢复会话: ${session.title} (${history.length} 条历史消息)`)
        } else if (args.continue) {
          const sessions = yield* store.list()
          if (sessions.length === 0) {
            console.log("没有历史会话，新建一个")
            const session = yield* store.create()
            sessionId = session.id
            messages = [systemPrompt]
          } else {
            const latest = sessions[0]!
            sessionId = latest.id
            const history = yield* store.loadMessages(sessionId)
            messages = [systemPrompt, ...history]
            console.log(`已恢复会话: ${latest.title} (${history.length} 条历史消息)`)
          }
        } else if (debugInputs) {
          const session = yield* store.create()
          sessionId = session.id
          messages = [systemPrompt]
          console.log(`AI 助手已启动（调试模式）→ 新建会话: ${session.title}`)
        } else if (args.message && args.message.length > 0) {
          const session = yield* store.create()
          sessionId = session.id
          messages = [systemPrompt]
        } else {
          const sessions = yield* store.list()
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
              const session = yield* store.create()
              sessionId = session.id
              messages = [systemPrompt]
              console.log(`\n已新建会话: ${session.title}`)
            } else if (choiceNum >= 0 && choiceNum < sessions.length) {
              const selected = sessions[choiceNum]!
              sessionId = selected.id
              const history = yield* store.loadMessages(sessionId)
              messages = [systemPrompt, ...history]
              console.log(`\n已恢复会话: ${selected.title} (${history.length} 条历史消息)`)
            } else {
              console.log("无效选择，退出")
              process.exit(1)
            }
          } else {
            const session = yield* store.create()
            sessionId = session.id
            messages = [systemPrompt]
            console.log(`AI 助手已启动 → 新建会话: ${session.title}`)
          }
        }

        // 4. 运行 agent loop（持久化通过 onMessage 回调走 SessionStore 服务）
        const runLoop = Effect.fn("runLoop")(function* (msgs: Message[]) {
          yield* runAgentLoop(msgs, {
            onChunk(text) {
              process.stdout.write(text)
            },
            onToolCall(id, name, args) {
              console.log(`\n  [调用工具] ${name}(${args})`)
            },
            onToolResult(_id, _output) {
              // CLI 版不展示工具结果（太长了），只展示调用名
            },
            // CLI 版需要持久化：每次加消息存数据库（走 SessionStore 服务）
            // 注意：saveMessage 是异步 Effect，不能用 Effect.runSync（会报
            // "An asynchronous Effect was executed with Effect.runSync"）
            // 用 Effect.runPromise 异步执行（不阻塞 agent loop）
            onMessage(msg) {
              void Effect.runPromise(store.saveMessage(sessionId, msg))
            },
          })
        })

        // 5. 非交互模式
        if (args.message && args.message.length > 0) {
          const input = args.message.join(" ")
          const userMsg: Message = { role: "user", content: input }
          messages.push(userMsg)
          yield* store.saveMessage(sessionId, userMsg)
          process.stdout.write("AI: ")
          yield* runLoop(messages)
          console.log()
          return
        }

        // 6. 交互模式
        console.log("\n输入问题开始对话（Ctrl+C 退出）\n")
        let debugIndex = 0
        while (true) {
          const input = debugInputs ? debugInputs[debugIndex++] : prompt("你: ")
          if (!input) break
          const userMsg: Message = { role: "user", content: input }
          messages.push(userMsg)
          yield* store.saveMessage(sessionId, userMsg)
          process.stdout.write("AI: ")
          yield* runLoop(messages)
          console.log("\n")
        }
      })

      // 提供所有 Layer 后跑起来
      // 注意：program 是 Effect.fn 返回的"函数"，调用 program() 才得到 Effect
      void Effect.runPromise(program().pipe(Effect.provide(appLayers)))
    },
  )
  .demandCommand(1, "请指定命令，用 --help 查看可用命令")
  .strict()
  .help("help", "显示帮助")
  .alias("help", "h")
  .parse()
