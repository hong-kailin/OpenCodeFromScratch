// src/llm.ts
// LLM 客户端：读配置 + 调 API（非流式 + 流式）
// 跑法：bun run src/index.ts（index.ts 会 import 这个模块）

import type { Message } from "./types"

// 读取 opencode.json 配置，解析出 baseURL、apiKey、modelID
export async function loadConfig(): Promise<{ baseURL: string; apiKey: string; modelID: string }> {
  const config = await Bun.file("opencode.json").json()

  // "volcengine-plan/deepseek-v4-flash" 拆成 providerID 和 modelID
  const [providerID, modelID] = config.model.split("/")
  const provider = config.provider[providerID]

  if (!provider) {
    throw new Error(`配置文件里找不到 provider: ${providerID}`)
  }

  return { baseURL: provider.baseURL, apiKey: provider.apiKey, modelID }
}

// 非流式调 LLM API：等全部生成完，一次性返回完整文本
// （阶段 1 的版本，保留作为对比）
export async function chat(
  messages: Message[],
  config: { baseURL: string; apiKey: string; modelID: string },
): Promise<string> {
  const response = await fetch(`${config.baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.modelID,
      messages,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`API 错误 ${response.status}: ${errorText}`)
  }

  const data = (await response.json()) as {
    choices: { message: { content: string } }[]
  }

  return data.choices[0]!.message.content
}

// ── 流式版本 ──────────────────────────────────────────────────
//
// 和 chat() 的区别：
// 1. 请求 body 多了 stream: true，服务器逐块返回（SSE 格式）
// 2. 不用 response.json() 一次性读，而是用 for await 逐块读 response.body
// 3. 通过回调函数 onChunk 把每段文本交给调用者（比如逐字打印）
// 4. 同时收集完整文本，最后返回（用于加入 messages 历史）
//
// onChunk 参数的类型是 (text: string) => void：
//   这是一个函数类型，接收 string 参数，返回 void（不返回）
//   类比 Python 的 Callable[[str], None]
//   调用者传一个函数进来，chatStream 每收到一段文本就调用它
export async function chatStream(
  messages: Message[],
  config: { baseURL: string; apiKey: string; modelID: string },
  onChunk: (text: string) => void,
): Promise<string> {
  // 发流式请求（和 chat() 的区别：body 里多了 stream: true）
  const response = await fetch(`${config.baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.modelID,
      stream: true, // ← 关键：开启流式，服务器会逐块返回
      messages,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`API 错误 ${response.status}: ${errorText}`)
  }

  // 逐块读取流式响应
  const decoder = new TextDecoder()
  let fullText = ""

  // response.body 是 ReadableStream | null，这里确定非空用 !
  // for await 逐块读取：每收到一块数据就循环一次
  for await (const chunk of response.body!) {
    // 字节 → 字符串
    // { stream: true } 处理跨 chunk 的 UTF-8 字符拆分（比如中文被拆成两半）
    const text = decoder.decode(chunk, { stream: true })

    // 按 SSE 格式解析（2.1 课学的格式）
    for (const line of text.split("\n")) {
      // 只关心 "data: " 开头的行
      if (!line.startsWith("data: ")) continue

      // 去掉 "data: " 前缀
      const data = line.slice(6)

      // [DONE] 表示流结束
      if (data === "[DONE]") continue

      // 解析 JSON，提取 delta.content（文本增量）
      const json = JSON.parse(data)
      const content = json.choices[0]?.delta?.content

      if (content) {
        // 调用回调函数，把这段文本交给调用者（比如打印到终端）
        onChunk(content)
        // 同时收集完整文本（最后返回，用于加入 messages 历史）
        fullText += content
      }
    }
  }

  // 返回完整文本（调用者用它加入 messages 历史）
  return fullText
}
