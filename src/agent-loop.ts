// src/agent-loop.ts
// agent loop 的核心逻辑：LLM 调用工具 -> 执行 -> 喂回结果 -> 继续调 LLM
//
// 10.4 课重构：
// 1. 把原来 CLI 版 runToolLoop（index.ts）和 TUI 版 runAgentLoop 合并成一个
//    runAgentLoop，消除重复逻辑（两者唯一区别是持久化，用 onMessage 回调注入）
// 2. provider 和 tools 不再作为参数传入，而是从 Context 自取（ProviderService /
//    ToolRegistry）——签名从 (messages, provider, tools, callbacks) 变成 (messages, callbacks)
// 3. 用 Effect.fn("runAgentLoop") 包装——opencode 的标志性模式，给函数加 trace 名

import { Effect } from "effect"
import type { Message } from "./types"
import { ProviderService } from "./service/provider"
import { ToolRegistry } from "./service/tool-registry"
import { truncate } from "./tool/truncate"
import { debug, debugMessages } from "./debug"

// 回调接口：调用方决定怎么处理事件（打印到终端 / 更新 TUI signal / 存数据库）
export interface LoopCallbacks {
  // LLM 流式输出文本时调用（每收到一个 token 调一次）
  onChunk: (text: string) => void
  // LLM 决定调用工具时调用
  // id 是这次工具调用的唯一标识（来自 LLM 返回的 tool_call.id）
  // 调用方可以用它把"开始调用"和"得到结果"关联到同一条记录
  onToolCall: (id: string, name: string, args: string) => void
  // 工具执行完毕时调用
  // id 对应 onToolCall 时的 id，调用方据此找到之前那条"执行中"的记录并更新为"已完成"
  onToolResult: (id: string, output: string) => void
  // 10.4 新增：每当 loop 往 messages 里加一条消息时调用（可选）
  // 原来 CLI 版 runToolLoop 每次 push 后都 saveMessage 持久化，
  // 合并后这个动作变成回调，由调用方决定要不要存库（CLI 存，TUI 不存）
  onMessage?: (msg: Message) => void
}

// Effect.fn("Name")(function* (...) {...})：opencode 的标志性模式
// - "runAgentLoop" 是 trace 名，调试/报错时能看到这个函数的名字
// - 函数体用 function*（generator），里面可以用 yield* 拆 Effect
// - 返回值是一个普通函数：调用 runAgentLoop(messages, callbacks) 得到一个 Effect
// - provider 和 tools 不再作为参数，而是函数体里 yield* 从 Context 取
export const runAgentLoop = Effect.fn("runAgentLoop")(function* (
  messages: Message[],
  callbacks: LoopCallbacks,
) {
  // ── 从 Context 取依赖 ─────────────────────────────────────
  // 10.3 课学的取服务：yield* 服务标签，从 Context 取下实例
  // provider 是一个 ProviderServiceApi 对象，有 chatWithTools 方法
  const provider = yield* ProviderService
  // tools 是一个 ToolRegistryApi 对象，list() 返回所有已注册的工具
  const tools = yield* ToolRegistry
  const toolList = tools.list()

  const MAX_STEPS = 20

  let step = 0
  while (step < MAX_STEPS) {
    step++
    debug(`── Step ${step}/${MAX_STEPS} ──`)
    debugMessages(messages)

    // chatWithTools 返回的是 Promise（10.4 只包 Service，没改返回值类型）
    // Effect.promise 把异步代码桥接成 Effect，yield* 等它完成
    // 这样在 Effect 世界里也能调用旧的非 Effect 代码（10.2 课学的桥接）
    const result = yield* Effect.promise(() =>
      provider.chatWithTools(messages, toolList, callbacks.onChunk),
    )

    debug("LLM 返回:", { text: result.text, toolCallsCount: result.toolCalls.length })

    // 没有 tool_calls → LLM 说完了，结束循环
    if (result.toolCalls.length === 0) {
      const assistantMsg: Message = { role: "assistant", content: result.text }
      messages.push(assistantMsg)
      callbacks.onMessage?.(assistantMsg)
      break
    }

    // 有 tool_calls → 把 assistant 消息（带 tool_calls）加入 messages
    const assistantMsg: Message = {
      role: "assistant",
      content: result.text || null,
      tool_calls: result.toolCalls,
    }
    messages.push(assistantMsg)
    callbacks.onMessage?.(assistantMsg)

    // 执行每个工具，把结果以 role: "tool" 加入 messages
    for (const tc of result.toolCalls) {
      const tool = toolList.find((t) => t.id === tc.function.name)
      // 通知调用方"开始调用工具"，带上 tc.id 以便后续关联结果
      callbacks.onToolCall(tc.id, tc.function.name, tc.function.arguments)

      let output: string
      if (!tool) {
        output = `错误：找不到工具 ${tc.function.name}`
      } else {
        const args = JSON.parse(tc.function.arguments)
        // 工具执行也是非 Effect 代码（execute 返回 Promise），同样用 Effect.promise 桥接
        output = yield* Effect.promise(() => tool.execute(args))
      }
      // 通知调用方"工具执行完毕"，用同一个 tc.id 找到刚才那条记录并更新
      callbacks.onToolResult(tc.id, output)

      const toolMsg: Message = {
        role: "tool",
        tool_call_id: tc.id,
        content: truncate(output),
      }
      messages.push(toolMsg)
      callbacks.onMessage?.(toolMsg)
    }
  }

  if (step >= MAX_STEPS) {
    debug("达到最大步数限制，停止循环")
  }
})
