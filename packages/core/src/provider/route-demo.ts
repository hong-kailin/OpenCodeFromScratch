// 可直接运行的 Route 教学 demo，不发网络请求，也不使用测试框架。
// 运行：bun run packages/core/src/provider/route-demo.ts
import { Effect, Schema, Stream } from "effect"
import type { Message, ToolCall } from "@opencode-from-scratch/schema"
import type { Tool } from "../tool/tool"
import type { LLMRequest } from "./protocol"
import { createOpenAIChatRoute } from "./openai-chat-route"

const messages: Message[] = [
  { role: "user", content: "读取 README.md" },
]

const readTool: Tool = {
  id: "read",
  description: "读取文件内容",
  parameters: Schema.Struct({ path: Schema.String }),
  // demo 只把工具说明发给 Protocol，不会真正执行工具。
  execute: () => Effect.succeed(""),
}

const request: LLMRequest = {
  modelID: "demo-model",
  messages,
  tools: [readTool],
}

// 这里是本节唯一出现四轴具体组合的地方。实际 Provider 也只创建这条路线。
const route = createOpenAIChatRoute({
  baseURL: "https://api.example.com/v1/",
  apiKey: "demo-token",
})

console.log("=== 请求侧：Route.prepare ===")
const prepared = route.prepare(request)
console.log("route:", route.id)
console.log("url:", prepared.url.toString())
console.log("authorization:", prepared.headers.get("Authorization"))
console.log("body:", prepared.body)

if (prepared.url.toString() !== "https://api.example.com/v1/chat/completions") {
  throw new Error("Route 没有正确应用 Endpoint")
}

if (prepared.headers.get("Authorization") !== "Bearer demo-token") {
  throw new Error("Route 没有正确应用 Auth")
}

const body = JSON.parse(prepared.body)
if (body.model !== "demo-model" || body.tools[0]?.function.name !== "read") {
  throw new Error("Route 没有正确应用请求 Protocol")
}

console.log("请求侧四轴装配通过\n")

console.log("=== 响应侧：Route.events ===")
const sse = [
  'data: {"choices":[{"delta":{"content":"开始读取。"}}]}\n\n',
  'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"read","arguments":"{\\"path\\":"}}]}}]}\n\n',
  'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\"README.md\\"}"}}]}}]}\n\n',
  "data: [DONE]\n\n",
].join("")

// 故意按任意字节位置切开，证明 Route 先用 Framing 恢复完整 frame，
// 再让 Protocol 校验和翻译；调用方不需要知道两者的衔接顺序。
const bytes = new TextEncoder().encode(sse)
const chunks = [bytes.slice(0, 31), bytes.slice(31, 97), bytes.slice(97, 181), bytes.slice(181)]
const byteStream = Stream.fromIterable(chunks)
const llmEvents = Array.from(
  await Effect.runPromise(Stream.runCollect(route.events(byteStream))),
)

console.log("通用 LLMEvent:")
console.log(llmEvents)

const text = llmEvents
  .filter((llmEvent) => llmEvent.type === "text-delta")
  .map((llmEvent) => llmEvent.text)
  .join("")
const toolCalls: ToolCall[] = llmEvents
  .filter((llmEvent) => llmEvent.type === "tool-call")
  .map((llmEvent) => llmEvent.toolCall)

if (text !== "开始读取。") {
  throw new Error(`Route 输出文本错误: ${text}`)
}

if (toolCalls[0]?.function.arguments !== '{"path":"README.md"}') {
  throw new Error("Route 没有通过 Protocol 拼接完整工具参数")
}

console.log("响应侧四轴装配通过")
console.log("\nRoute demo 通过")
