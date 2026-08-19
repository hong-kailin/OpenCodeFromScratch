// src/agent-loop.ts
// 阶段 12 教学代码：agent loop 用 Effect Service 重构
//
// 重构前（阶段 9）：
//   async function runAgentLoop(messages, provider, tools, callbacks) { ... }
//   provider 和 tools 是参数，调用方手动传
//
// 重构后（阶段 12）：
//   export const runAgentLoop = Effect.fn("runAgentLoop")(function* (messages, callbacks) { ... })
//   provider 和 tools 从 Context 自取（yield* ProviderService / yield* ToolRegistry）
//   签名从 4 个参数缩到 2 个——加新依赖不用改签名
//
// 同时合并了 CLI 版 runToolLoop 和 TUI 版 runAgentLoop：
// - 原来两个 loop 逻辑几乎一样，唯一区别是 CLI 版有 saveMessage 持久化
// - 现在用 onMessage 回调承载差异：CLI 传 saveMessage，TUI 不传

import { Effect } from "effect"
import type { Message } from "./types"
import { truncate } from "./tool/truncate"
import { ProviderService } from "./service/provider"
import { ToolRegistry } from "./service/tool-registry"

// 回调接口：调用方决定怎么处理事件
export interface LoopCallbacks {
  onChunk: (text: string) => void
  onToolCall: (id: string, name: string, args: string) => void
  onToolResult: (id: string, output: string) => void
  // 新增：每次往 messages 里加消息时调用
  // CLI 版传 saveMessage（持久化），TUI 版不传（不需要持久化）
  onMessage?: (msg: Message) => void
}

// Effect.fn("runAgentLoop") 给函数加 trace 名——调试时 fiber trace 里能看到
// 返回一个普通函数：调用 runAgentLoop(messages, callbacks) 得到 Effect
// 对照 opencode：每个重要函数都 Effect.fn("Name") 模式
export const runAgentLoop = Effect.fn("runAgentLoop")(function* (
  messages: Message[],
  callbacks: LoopCallbacks,
) {
  const MAX_STEPS = 20

  // provider 和 tools 不再从参数传——从 Context 自取
  const provider = yield* ProviderService
  const tools = yield* ToolRegistry
  const toolList = tools.list()

  let step = 0
  while (step < MAX_STEPS) {
    step++

    // 调 LLM：chatWithTools 返回 Promise，用 Effect.promise 桥接
    const result = yield* Effect.promise(() =>
      provider.chatWithTools(messages, toolList, callbacks.onChunk),
    )

    if (result.toolCalls.length === 0) {
      const assistantMsg: Message = {
        role: "assistant",
        content: result.text,
      }
      messages.push(assistantMsg)
      callbacks.onMessage?.(assistantMsg)
      break
    }

    const assistantMsg: Message = {
      role: "assistant",
      content: result.text || null,
      tool_calls: result.toolCalls,
    }
    messages.push(assistantMsg)
    callbacks.onMessage?.(assistantMsg)

    for (const tc of result.toolCalls) {
      const tool = toolList.find((t) => t.id === tc.function.name)
      callbacks.onToolCall(tc.id, tc.function.name, tc.function.arguments)

      let output: string
      if (!tool) {
        output = `错误：找不到工具 ${tc.function.name}`
      } else {
        const args = JSON.parse(tc.function.arguments)
        // 工具执行也是 Promise，同样桥接
        output = yield* Effect.promise(() => tool.execute(args))
      }
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
})