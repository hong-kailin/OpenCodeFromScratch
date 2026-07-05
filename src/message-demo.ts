// src/message-demo.ts
// 5.3 课教学代码：Message 存储演示
// 跑法：bun run src/message-demo.ts
// 演示保存各种类型的消息、加载、验证 JSON 序列化/反序列化

import { createSession } from "./session"
import { saveMessage, loadMessages } from "./message"
import type { Message } from "./types"

// 1. 创建一个 session
const session = await createSession("消息存储演示")
console.log(`=== 创建 session: ${session.id} ===\n`)

// 2. 保存各种类型的消息
console.log("=== 保存消息 ===")

// user 消息
const userMsg: Message = { role: "user", content: "帮我读一下 src/index.ts" }
await saveMessage(session.id, userMsg)
console.log("  ✓ user 消息")

// assistant 消息（带 tool_calls）
const assistantMsg: Message = {
  role: "assistant",
  content: null,
  tool_calls: [{
    id: "call_abc123",
    type: "function",
    function: { name: "read", arguments: '{"filePath":"src/index.ts"}' },
  }],
}
await saveMessage(session.id, assistantMsg)
console.log("  ✓ assistant 消息（带 tool_calls）")

// tool 消息（工具结果）
const toolMsg: Message = {
  role: "tool",
  tool_call_id: "call_abc123",
  content: "1  // src/index.ts\n2  console.log('hello')",
}
await saveMessage(session.id, toolMsg)
console.log("  ✓ tool 消息（工具结果）")

// assistant 最终回复
const replyMsg: Message = { role: "assistant", content: "这个文件就两行，打印了 hello" }
await saveMessage(session.id, replyMsg)
console.log("  ✓ assistant 最终回复")

// 3. 加载所有消息
console.log("\n=== 加载消息 ===")
const loaded = await loadMessages(session.id)
console.log(`  共 ${loaded.length} 条消息\n`)

for (const msg of loaded) {
  console.log(`  [${loaded.indexOf(msg)}] role=${msg.role}`)
  if (msg.content) {
    console.log(`      content: ${msg.content.slice(0, 60)}${msg.content.length > 60 ? "..." : ""}`)
  }
  if (msg.tool_calls) {
    console.log(`      tool_calls: ${JSON.stringify(msg.tool_calls, null, 2).split("\n").join("\n      ")}`)
  }
  if (msg.tool_call_id) {
    console.log(`      tool_call_id: ${msg.tool_call_id}`)
  }
}

// 4. 验证 JSON 序列化/反序列化正确
console.log("\n=== 验证 ===")
const savedAssistant = loaded[1]!
const hasToolCalls = savedAssistant.tool_calls !== undefined && savedAssistant.tool_calls.length > 0
console.log(`  assistant 消息的 tool_calls 还原成功: ${hasToolCalls ? "✓" : "✗"}`)
if (hasToolCalls) {
  console.log(`  tool_calls[0].function.name = "${savedAssistant.tool_calls![0]!.function.name}" ✓`)
  console.log(`  tool_calls[0].function.arguments = '${savedAssistant.tool_calls![0]!.function.arguments}' ✓`)
}
