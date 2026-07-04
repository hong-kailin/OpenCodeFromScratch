# 2.2 用 fetch 读流式响应：ReadableStream

> 本课目标：用 TS 代码逐块读取 SSE 流式响应，提取文本增量，逐字打印到终端。

> 前置：先读 [2.1 SSE 格式](../01-what-is-streaming/01-what-is-streaming.md) 理解流式响应长什么样。

## 从 response.json() 到 response.body

阶段 1 我们用 `await response.json()` 一次性读取整个响应。流式不能这样——要逐块读取。

`fetch` 返回的 `response` 有两个读法：

| | 非流式（阶段 1） | 流式（本课） |
|---|-----------------|-------------|
| 读法 | `await response.json()` | `response.body`（流式读取） |
| 返回 | 一个完整 JSON 对象 | 一个 ReadableStream（逐块给数据） |
| 类比 | 下载完再打开 | 边下载边看 |

`response.body` 是一个 **ReadableStream**——你可以把它想象成一根水管，数据一块一块地流过来。

## for await：异步遍历

怎么从 ReadableStream 里逐块取数据？用 `for await` 循环——这是 1.3 课学的 `await` 的延伸，专门用来遍历"异步给数据的东西"：

```ts
// for await：逐块读取流
for await (const chunk of response.body) {
  // chunk 是一块数据（Uint8Array，字节数组）
  console.log(chunk)
}
```

> 类比：`for await` 和 `for...of` 的区别，就像 `await` 和普通变量的区别。
>
> ```ts
> // 普通 for...of：同步遍历数组，元素已经全部就绪
> for (const item of [1, 2, 3]) { ... }
>
> // for await：异步遍历流，元素一个一个到
> for await (const chunk of stream) { ... }
> ```

每循环一次，`chunk` 就是服务器发来的一块数据。但 `chunk` 是 `Uint8Array`（字节数组），不是字符串——需要解码。

## 解码字节为文本

`chunk` 是原始字节，用 `TextDecoder` 解码成字符串：

```ts
const decoder = new TextDecoder()
for await (const chunk of response.body) {
  const text = decoder.decode(chunk)  // 字节 → 字符串
  console.log(text)
}
```

> 类比 Python：`chunk.decode("utf-8")`。

## 解析 SSE 格式

解码出来的 `text` 是 SSE 原始文本，长这样：

```
data: {"choices":[{"delta":{"content":"闭"},"finish_reason":null}]}

data: {"choices":[{"delta":{"content":"包"},"finish_reason":null}]}

data: [DONE]
```

要从中提取有用的内容，分几步：

### 第 1 步：按行分割

一个 `chunk` 可能包含多行，也可能只有半行（SSE 块可能被拆成多个 chunk）。先按 `\n` 分割：

```ts
const lines = text.split("\n")
```

### 第 2 步：过滤出 data 行

只关心 `data: ` 开头的行，忽略空行和其他行：

```ts
for (const line of lines) {
  if (!line.startsWith("data: ")) continue  // 跳过非 data 行

  const data = line.slice(6)  // 去掉 "data: " 前缀，拿到后面的内容
}
```

### 第 3 步：处理 [DONE]

`data: [DONE]` 表示流结束：

```ts
if (data === "[DONE]") {
  break  // 流结束，退出循环
}
```

### 第 4 步：解析 JSON，提取 delta.content

```ts
const json = JSON.parse(data)
const content = json.choices[0]?.delta?.content
if (content) {
  process.stdout.write(content)  // 立刻打印这一小段文本（不换行）
}
```

注意这里用 `process.stdout.write()` 而不是 `console.log()`——`console.log` 每次会加换行，流式打印不需要换行。

> 类比 Python：`print(content, end="", flush=True)`——不换行，立刻刷新输出。

## 完整代码

看教学代码 [`src/stream-demo.ts`](../../../src/stream-demo.ts)：

```ts
// src/stream-demo.ts
import { loadConfig } from "./llm"

const config = await loadConfig()

// 发流式请求（多了 stream: true）
const response = await fetch(`${config.baseURL}/chat/completions`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.apiKey}`,
  },
  body: JSON.stringify({
    model: config.modelID,
    stream: true,  // ← 关键：开启流式
    messages: [
      { role: "system", content: "你是一个简洁的助手，用中文回答" },
      { role: "user", content: "什么是闭包？一句话解释" },
    ],
  }),
})

// 逐块读取流式响应
const decoder = new TextDecoder()
for await (const chunk of response.body) {
  const text = decoder.decode(chunk)

  // 按 SSE 格式解析
  for (const line of text.split("\n")) {
    if (!line.startsWith("data: ")) continue

    const data = line.slice(6)
    if (data === "[DONE]") break

    const json = JSON.parse(data)
    const content = json.choices[0]?.delta?.content
    if (content) {
      process.stdout.write(content)  // 逐字打印，不换行
    }
  }
}

console.log()  // 最后补一个换行
```

## 跑起来

```bash
bun run src/stream-demo.ts
```

你会看到 AI 的回复逐字打印出来，像打字机一样。

## 教 Debug

### 程序卡住不动

可能原因：
1. **忘了 `stream: true`**：服务器返回非流式响应，`response.body` 只有一个大 chunk，`for await` 读完就结束。检查请求 body 里有没有 `"stream": true`
2. **网络慢**：第一个 chunk 还没到，等一下

### 打印出来是乱码

可能原因：chunk 边界把一个 UTF-8 字符拆成了两半。用 `decoder.decode(chunk, { stream: true })` 告诉 decoder "后面还有数据，别急着解码不完整的字符"：

```ts
const decoder = new TextDecoder()
for await (const chunk of response.body) {
  const text = decoder.decode(chunk, { stream: true })  // ← 加 { stream: true }
  // ...
}
```

### JSON.parse 报错

可能原因：一个 SSE 块被拆成了两个 chunk，`line` 只有半截 JSON。这种情况需要缓冲不完整的行。教学代码里简化处理了，2.3 课封装完整版时会解决。

### 打印有换行

用了 `console.log()` 而不是 `process.stdout.write()`。`console.log` 每次自动加 `\n`，流式打印要用 `process.stdout.write()` 不换行。

## 本课小结

1. **response.body**：fetch 返回的流式读取接口，是 ReadableStream
2. **for await**：异步遍历流，逐块拿到数据（`for await (const chunk of response.body)`）
3. **TextDecoder**：把字节数组（Uint8Array）解码成字符串
4. **SSE 解析四步**：按行分割 → 过滤 `data: ` 行 → 处理 `[DONE]` → 解析 JSON 提取 `delta.content`
5. **process.stdout.write**：打印不换行，流式输出用这个而不是 `console.log`
6. **decoder.decode(chunk, { stream: true })**：处理跨 chunk 的 UTF-8 字符拆分

下一步：[2.3 封装流式 chat 函数](../03-chat-stream/01-chat-stream.md) —— 把流式读取封装成函数，集成到多轮对话。
