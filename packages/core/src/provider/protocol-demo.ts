// 这个文件是可以直接运行的教学 demo，不使用测试框架，也不发网络请求。
// 运行：bun run packages/core/src/provider/protocol-demo.ts
//
// 一个 Protocol 同时负责请求和响应两种翻译，所以这里把两个方向放在一次运行中观察。
import { Effect, Schema } from "effect"
import type { Message, ToolCall } from "@opencode-from-scratch/schema"
import type { Tool } from "../tool/tool"
import type { LLMEvent, LLMRequest } from "./protocol"
import { openAIChatProtocol } from "./openai-chat-protocol"

function runRequestDirection() {
  console.log("=== 请求方向：LLMRequest -> OpenAI Chat Body ===")

  const messages: Message[] = [
    { role: "system", content: "你是一个编程助手" },
    { role: "user", content: "读取 README.md" },
  ]

  // execute 在 demo 中不会运行。项目内部 Tool 必须包含执行函数；Protocol 只会把
  // id、description 和 parameters 投影成发给 LLM 的 function tool。
  const demoTool: Tool = {
    id: "read",
    description: "读取文件内容",
    parameters: Schema.Struct({
      path: Schema.String,
    }),
    execute: () => Effect.succeed(""),
  }

  const request: LLMRequest = {
    modelID: "demo-model",
    messages,
    tools: [demoTool],
  }

  const body = openAIChatProtocol.encodeRequest(request)

  console.log("通用请求:")
  console.log("  modelID:", request.modelID)
  console.log("  tool id:", request.tools[0]?.id)
  console.log("OpenAI Chat body:")
  console.log(JSON.stringify(body, null, 2))

  if (body.model !== "demo-model") {
    throw new Error("Protocol 没有把 modelID 转成 model")
  }

  if (body.stream !== true) {
    throw new Error("Protocol 没有启用流式响应")
  }

  if (body.tools[0]?.function.name !== "read") {
    throw new Error("Protocol 没有把 Tool 转成 OpenAI function tool")
  }

  console.log("请求方向通过\n")
}

function runResponseDirection() {
  console.log("=== 响应方向：OpenAI Chat Frame -> LLMEvent ===")

  // 这些字符串模拟 sseFraming 已经切好的 data payload。
  // 同一个工具调用的 arguments 被故意拆成两帧，用来观察 Protocol 的跨帧状态。
  const frames = [
    '{"choices":[{"delta":{"content":"我来"}}]}',
    '{"choices":[{"delta":{"content":"读取文件。"}}]}',
    '{"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"read","arguments":"{\\"path\\":"}}]}}]}',
    '{"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\"README.md\\"}"}}]}}]}',
  ]

  let state = openAIChatProtocol.response.initial()
  const llmEvents: LLMEvent[] = []

  // frame 必须按到达顺序更新 state，因此这里使用顺序明确的 for...of。
  for (const frame of frames) {
    // decodeFrame 先做 JSON 解析，再用 Effect Schema 校验厂商事件结构。
    const vendorEvent = openAIChatProtocol.response.decodeFrame(frame)
    const result = openAIChatProtocol.response.step(state, vendorEvent)

    state = result.state
    llmEvents.push(...result.llmEvents)

    console.log("收到 frame:", frame)
    console.log("本帧通用 LLMEvent:", result.llmEvents)
  }

  // 工具调用只有在流结束后才能确认参数完整，所以 finish 才发布 tool-call 事件。
  llmEvents.push(...openAIChatProtocol.response.finish(state))

  let text = ""
  const toolCalls: ToolCall[] = []

  // 从这里开始，消费方只认识通用 LLMEvent，不再读取 choices[0].delta。
  for (const llmEvent of llmEvents) {
    if (llmEvent.type === "text-delta") {
      text += llmEvent.text
      continue
    }

    toolCalls.push(llmEvent.toolCall)
  }

  console.log("Protocol 输出:")
  console.log("  text:", text)
  console.log("  toolCalls:", JSON.stringify(toolCalls, null, 2))

  if (text !== "我来读取文件。") {
    throw new Error(`文本拼接错误: ${text}`)
  }

  if (toolCalls[0]?.function.arguments !== '{"path":"README.md"}') {
    throw new Error("工具 arguments 没有正确跨帧拼接")
  }

  // 合法 JSON 但 choices 类型错误，应该在 Schema 校验阶段被拒绝。
  let invalidError: unknown
  try {
    openAIChatProtocol.response.decodeFrame('{"choices":"不是数组"}')
  } catch (error) {
    invalidError = error
  }

  if (!invalidError) {
    throw new Error("错误结构没有被 Schema 拒绝")
  }

  console.log("无效 frame 已被拒绝:")
  console.log(String(invalidError).split("\n")[0])
  console.log("响应方向通过\n")
}

runRequestDirection()
runResponseDirection()

console.log("OpenAI Chat Protocol 双向 demo 通过")
