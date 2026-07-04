// src/stream-demo.ts
// 2.2 课教学代码：用 fetch 读流式响应
// 跑法：bun run src/stream-demo.ts

import { loadConfig } from "./llm"

const config = await loadConfig()

// 发流式请求（和阶段 1 的区别：body 里多了 stream: true）
const response = await fetch(`${config.baseURL}/chat/completions`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.apiKey}`,
  },
  body: JSON.stringify({
    model: config.modelID,
    stream: true, // ← 关键：开启流式，服务器会逐块返回
    messages: [
      { role: "system", content: "你是一个简洁的助手，用中文回答" },
      { role: "user", content: "什么是闭包？一句话解释" },
    ],
  }),
})

// 检查状态码
if (!response.ok) {
  const errorText = await response.text()
  throw new Error(`API 错误 ${response.status}: ${errorText}`)
}

// 逐块读取流式响应
// response.body 是 ReadableStream，用 for await 逐块读取
// 每个 chunk 是 Uint8Array（字节数组），不是字符串
const decoder = new TextDecoder()

console.log("=== 流式输出开始 ===")

// response.body 的类型是 ReadableStream | null，这里确定非空用 !
for await (const chunk of response.body!) {
  // 1. 字节 → 字符串（stream: true 处理跨 chunk 的 UTF-8 字符拆分）
  const text = decoder.decode(chunk, { stream: true })

  // 2. 按 SSE 格式解析
  for (const line of text.split("\n")) {
    // 只关心 "data: " 开头的行，跳过空行和其他行
    if (!line.startsWith("data: ")) continue

    // 去掉 "data: " 前缀，拿到后面的内容
    const data = line.slice(6)

    // [DONE] 表示流结束
    if (data === "[DONE]") {
      console.log("\n=== 流式输出结束 ===")
      break
    }

    // 解析 JSON，提取 delta.content（文本增量）
    const json = JSON.parse(data)
    const content = json.choices[0]?.delta?.content

    // 有内容就立刻打印（不换行，逐字打印效果）
    if (content) {
      process.stdout.write(content)
    }
  }
}
