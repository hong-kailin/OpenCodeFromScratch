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
//
// 阶段 13 改动：工具参数解析从"裸 JSON.parse"升级为"Schema 校验"
//   const args = JSON.parse(tc.function.arguments)  // 之前：无校验，类型是 any
//   Schema.decodeUnknownEffect(tool.parameters)(raw) // 现在：运行期校验，失败抛错误
// 校验失败的错误会作为工具结果喂回给 LLM（让它重新调用），而不是中断 loop

import { Effect, Schema } from "effect"
import type { Message } from "@opencode-from-scratch/schema"
import {
  truncate,
  ProviderService,
  ToolRegistry,
  FileSystemService,
  ToolError,
} from "@opencode-from-scratch/core"

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

    // 从 Context 取 FileSystem 服务——工具 execute 需要它（16.3 起工具走服务）
    const fs = yield* FileSystemService

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
        // 阶段 13：用 Schema 校验工具参数，替换裸 JSON.parse
        // 流程（对照 opencode llm/tool-runtime.ts 的 decodeAndExecute）：
        //   1. JSON.parse      —— LLM 返回的 arguments 是 JSON 字符串，解析成对象
        //   2. Schema.decodeUnknownEffect —— 用工具的 Schema 校验参数结构
        //      参数对 → 返回类型安全的 args；参数错 → Effect 失败（mapError 成 ToolError）
        //   3. Effect.catch  —— 把解析/校验/执行任何失败转成错误文本
        // 最终 output 一定是字符串：成功是工具结果，失败是错误说明，
        // 两者都会作为 tool 消息喂回给 LLM（让它在下一步自纠正）——这正是 opencode
        // "InvalidArgumentsError 的错误文本会作为工具结果返回给模型"的设计。
        //
        // 注意：mapError 要包在 Schema 解码这一段，而不是整个链上。
        // 如果包在整个链上，JSON.parse 阶段的 ToolError 也会被 mapError 再包装一次，
        // 导致错误文本冗余（"校验失败: ToolError: 不是合法 JSON"）。
        // 阶段 16.3：tool.execute(args) 现在直接返回 Effect（不再包 Effect.promise）
        // 因为工具内部已经能 yield* FileSystem.Service 取依赖了。
        //
        // 关于类型（重要，教学点）：
        //   注册表返回 Tool<any, any>，所以 tool.execute 的 R 类型是 any（泛型丢失）。
        //   Effect.gen/Effect.fn 有个已知特性：只要 yield* 的 Effect 的 R 是 any，
        //   整个 generator 的 R 就会退化成 any（污染）。所以必须在这里把 R 收干净。
        //   运行时工具确实需要 FileSystem 服务——用 Effect.provideService 显式喂入
        //   （fs 是本函数开头 yield* FileSystemService 拿到的实例）。
        //   类型层面：provideService 对 any 无法收窄，所以在整个 runTool 的"最终结果"
        //   上做一次断言，告诉 tsc"工具所需的服务已全部提供"。
        //   对照 opencode：它在更早的层面 provide 完整 Context，我们这里是"执行时即时提供"。
        const runTool = Effect.try({
          try: () => JSON.parse(tc.function.arguments),
          catch: (e) =>
            new ToolError({
              message: `工具 ${tool.id} 参数不是合法 JSON: ${e instanceof Error ? e.message : String(e)}`,
              toolName: tool.id,
            }),
        }).pipe(
          Effect.flatMap((rawArgs) =>
            Schema.decodeUnknownEffect(tool.parameters)(rawArgs).pipe(
              Effect.mapError(
                (e) => new ToolError({ message: `工具 ${tool.id} 参数校验失败: ${String(e)}`, toolName: tool.id }),
              ),
              // 校验通过：执行工具。先 provide FileSystem（运行时必需），再断言 R 已满足
              Effect.flatMap((args) =>
                tool.execute(args).pipe(Effect.provideService(FileSystemService, fs)),
              ),
            ),
          ),
          // 兜底：任何失败（ToolError / execute 抛错）都转成错误文本，不中断 loop
          Effect.catch((e) => Effect.succeed(e instanceof Error ? e.message : String(e))),
          // 关键：在这里（整个 runTool 的最终结果）把 R 从 any 断言成 never。
          // 这样 generator 只 yield* 一个 R=never 的 Effect，不会污染 runAgentLoop 的 R。
          (effect) => effect as Effect.Effect<string, never, never>,
        )
        output = yield* runTool
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