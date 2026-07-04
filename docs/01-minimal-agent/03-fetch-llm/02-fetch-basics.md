# 1.3 用 fetch 调 API：读配置 + 发请求

> 本课目标：用 TypeScript 代码读配置文件、调 LLM API。上一课学了 async/await，这课用到实处。

> 前置：先读 [01-async-await.md](./01-async-await.md) 理解 async/await 和 Promise。

## 从 curl 到 fetch

上一课（1.2）我们用 curl 手动调了 API。curl 是命令行工具，真正写程序时用 TS 内置的 `fetch` 函数——和 Python 的 `requests.post` 一样，用来发 HTTP 请求。

对照看：

```python
# Python
import requests
response = requests.post(url, headers={...}, json={...})
data = response.json()
print(data["choices"][0]["message"]["content"])
```

```ts
// TypeScript
const response = await fetch(url, {
  method: "POST",
  headers: { ... },
  body: JSON.stringify({ ... }),
})
const data = await response.json()
console.log(data.choices[0].message.content)
```

结构几乎一样。`fetch` 返回 Promise（上一课讲的），所以要用 `await`。

## fetch 语法

`fetch` 是 TS/Bun 内置函数，参数和 HTTP 四部分对应（1.2 课学的）：

```ts
const response = await fetch("https://ark.../chat/completions", {  // URL
  method: "POST",                                                   // Method
  headers: {                                                        // Headers
    "Content-Type": "application/json",
    "Authorization": `Bearer ${apiKey}`,
  },
  body: JSON.stringify({                                            // Body
    model: "deepseek-v4-flash",
    messages: [{ role: "user", content: "你好" }],
  }),
})
```

| HTTP 部分 | fetch 里 | 说明 |
|-----------|----------|------|
| URL | 第一个参数 | 请求地址 |
| Method | `method: "POST"` | 请求方法 |
| Headers | `headers: { ... }` | 请求头 |
| Body | `body: JSON.stringify(...)` | 请求体 |

### 模板字符串

注意 `"Authorization": \`Bearer ${apiKey}\`` 这个写法。这叫**模板字符串**，用反引号（`` ` ``）包裹，`${变量}` 会被替换成变量的值。

```ts
const apiKey = "ark-xxx"
const header = `Bearer ${apiKey}`  // "Bearer ark-xxx"
```

> Python 类比：f-string，`f"Bearer {apiKey}"`。

### JSON.stringify 和 response.json()

Python 的 requests 库帮你处理了 JSON 序列化（`json={...}` 自动转字符串）。TS 的 fetch 要手动处理：

```ts
// 发请求时：手动序列化
body: JSON.stringify({ model: "deepseek-v4-flash", messages: [...] })

// 收响应时：手动解析
const data = await response.json()
```

| | Python requests | TS fetch |
|---|----------------|----------|
| 发请求时 | `json={...}`（自动序列化） | `body: JSON.stringify(...)`（手动序列化） |
| 收响应时 | `response.json()` | `await response.json()` |

### response.ok：检查状态码

`fetch` 不会因为 401/429 自动报错（和 Python requests 一样）。要手动检查：

```ts
if (!response.ok) {
  const error = await response.text()
  throw new Error(`API 错误 ${response.status}: ${error}`)
}
```

`response.ok` 是 `true` 表示状态码 2xx（成功），`false` 表示出错。`response.status` 是具体状态码（401、429 等）。

## 读配置文件

上一课我们配了 `opencode.json`。现在用 TS 代码读它。Bun 内置了 `Bun.file()` 读取文件：

```ts
const file = Bun.file("opencode.json")
const config = await file.json()
```

`Bun.file()` 返回一个文件对象，`.json()` 异步读取并解析 JSON（返回 Promise，所以要 `await`）。

### 配置的类型定义

用 0.2 课学的 interface 定义配置结构：

```ts
interface Message {
  role: "system" | "user" | "assistant"  // union 类型，role 只能是这三个值
  content: string
}

interface ProviderConfig {
  name: string
  baseURL: string
  apiKey: string
  models: Record<string, object>
}

interface Config {
  model: string                          // "provider/model" 格式
  provider: Record<string, ProviderConfig>
}
```

### 解析 "provider/model" 字符串

配置里 `"model": "volcengine-plan/deepseek-v4-flash"`，要拆成 providerID 和 modelID：

```ts
const [providerID, modelID] = config.model.split("/")
// providerID = "volcengine-plan"
// modelID = "deepseek-v4-flash"
```

`split("/")` 按斜杠分割字符串，返回数组。`[providerID, modelID]` 是解构赋值——把数组拆成两个变量。

## 完整代码

看教学代码 [`src/types.ts`](../../../src/types.ts)、[`src/llm.ts`](../../../src/llm.ts) 和 [`src/index.ts`](../../../src/index.ts)。

### src/types.ts：类型定义

```ts
export interface Message {
  role: "system" | "user" | "assistant"
  content: string
}

export interface ProviderConfig {
  name: string
  baseURL: string
  apiKey: string
  models: Record<string, object>
}

export interface Config {
  model: string
  provider: Record<string, ProviderConfig>
}
```

### src/llm.ts：封装 chat 函数

```ts
import type { Message } from "./types"

// 读配置，拿到 baseURL、apiKey、modelID
export async function loadConfig() {
  const config = await Bun.file("opencode.json").json()
  const [providerID, modelID] = config.model.split("/")
  const provider = config.provider[providerID]
  return { baseURL: provider.baseURL, apiKey: provider.apiKey, modelID }
}

// 调 LLM API，传入 messages，返回回复文本
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
    const error = await response.text()
    throw new Error(`API 错误 ${response.status}: ${error}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
}
```

### src/index.ts：入口

```ts
import type { Message } from "./types"
import { loadConfig, chat } from "./llm"

// 顶层 await（入口文件可以直接用）
const config = await loadConfig()

const messages: Message[] = [
  { role: "system", content: "你是一个简洁的助手，用中文回答" },
  { role: "user", content: "什么是闭包？一句话解释" },
]

const reply = await chat(messages, config)
console.log(reply)
```

## 跑起来

```bash
bun run src/index.ts
```

期望输出 AI 的回复。

## 教 Debug

### 报错：Cannot read property 'baseURL' of undefined

说明 `config.provider[providerID]` 拿不到 provider。检查：

1. `opencode.json` 里的 `model` 字段——providerID 要和 `provider` 里的 key 对上
2. JSON 格式有没有写错（少了逗号、引号没闭合等）

### 报错：API 错误 401

apiKey 不对。检查 `opencode.json` 里的 `apiKey` 是否正确。

### 报错：fetch failed

URL 不对或网络不通。检查 `baseURL` 拼接是否正确，终端能不能 `curl` 通。

## 本课小结

1. **fetch**：TS 内置的发 HTTP 请求函数，返回 Promise，要用 `await`
2. **模板字符串**：反引号 + `${变量}`，类比 Python f-string
3. **JSON.stringify / response.json()**：手动序列化和解析 JSON
4. **response.ok**：检查状态码是否 2xx
5. **Bun.file().json()**：读 JSON 配置文件
6. **split + 解构赋值**：解析 "provider/model" 字符串
7. **顶层 await**：入口文件可以直接用 `await`，不用包 async 函数

下一步：[1.4 命令行交互](../04-cli-chat/01-cli-chat.md) —— 加上 readline，实现多轮对话。
