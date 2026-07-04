// src/llm.ts
// LLM 客户端：读配置 + 调 API
// 跑法：bun run src/index.ts（index.ts 会 import 这个模块）

import type { Message, Config } from "./types"

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

// 调 LLM API：传入 messages 数组，返回 AI 的回复文本
export async function chat(
  messages: Message[],
  config: { baseURL: string; apiKey: string; modelID: string },
): Promise<string> {
  // 发 POST 请求（类比 Python requests.post）
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

  // 检查状态码（非 2xx 报错）
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`API 错误 ${response.status}: ${errorText}`)
  }

  // 解析 JSON 响应，提取 AI 回复
  //
  // response.json() 返回的类型是 unknown（TS 不知道 JSON 长什么样）。
  // 用 as 关键字"告诉"TS 这个 JSON 的结构，这样就能用 data.choices[0] 访问了。
  //
  // 为什么需要 as？因为 TS 不像 Python 能动态访问字典键。
  // Python: data["choices"][0]["message"]["content"]  # 运行时访问，不管类型
  // TS:     data.choices[0].message.content            # 编译时检查，需要知道 data 的类型
  //
  // as 后面是这个 JSON 的类型描述，对照 1.2 课的响应结构：
  // {
  //   "choices": [                          ← choices 是数组 [...]
  //     {
  //       "message": {                      ← 每个元素有 message 对象
  //         "content": "AI 的回复"           ← message 里有 content 字符串
  //       }
  //     }
  //   ]
  // }
  //
  // 对应的 TS 类型：
  // {
  //   choices: { message: { content: string } }[]
  //   └─数组─┘  └─对象─┘  └─对象─┘  └字符串─┘
  // }
  //
  // [] 写在类型后面表示"数组"：
  //   string   → 一个字符串
  //   string[] → 字符串数组
  //   { message: { content: string } }[] → 对象数组，每个对象有 message.content
  const data = (await response.json()) as {
    choices: { message: { content: string } }[]
  }

  // data.choices[0] 取数组第一个元素
  // ! 是非空断言：告诉 TS "我确定 choices[0] 不是 undefined"（strict 模式下 TS 认为数组取值可能为空）
  return data.choices[0]!.message.content
}
