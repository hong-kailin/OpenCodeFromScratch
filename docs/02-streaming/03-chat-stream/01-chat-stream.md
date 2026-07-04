# 2.3 封装流式 chatStream + 集成到多轮对话

> 本课目标：把 2.2 课的流式读取封装成 `chatStream()` 函数，替换阶段 1 的 `chat()`，实现多轮对话 + 逐字打印。

## 上一课的问题

2.2 课的 `stream-demo.ts` 把所有代码写在了一起——发请求、读流、解析 SSE、打印。如果要在多轮对话里用，这些逻辑要封装成函数。

回顾阶段 1 的 `chat()` 函数：

```ts
// 阶段 1：非流式，等全部生成完，返回完整文本
async function chat(messages, config): Promise<string> {
  const response = await fetch(...)
  const data = await response.json()
  return data.choices[0].message.content  // 一次性返回
}
```

流式版要改什么？返回值还是完整文本（要加入 messages 历史），但过程中要逐字打印。

## 回调函数：让调用者处理每一段文本

问题：`chatStream` 逐块收到文本，想立刻打印。但函数还没结束（流还没读完），不能 return。怎么把每一段文本传给调用者？

用**回调函数**——调用者传一个函数进来，`chatStream` 每收到一段文本就调用它。

### 回调函数是什么

回调函数其实你已经用过了，只是没意识到。**回调函数就是把函数当参数传给另一个函数，让它在合适的时候帮你调用。**

Python 里你肯定写过这种代码：

```python
# sorted 的 key 参数就是一个回调函数
names = ["alice", "Bob", "charlie"]
sorted(names, key=len)             # len 就是回调：sorted 会对每个元素调用 len
sorted(names, key=str.lower)       # str.lower 就是回调
sorted(names, key=lambda x: x[1])  # lambda 也是回调：取第二个字符排序
```

`sorted` 不知道你要按什么规则排序，所以它让你传一个函数（回调）进来，它来调用。**你提供规则，它负责执行。**

### 生活中的类比

你去干洗店洗衣服：

- **没有回调**：你把衣服放下，3 天后来取。中间你不知道洗到哪了
- **有回调**：你把衣服放下，同时留一个电话号码（回调函数）。洗好一个步骤就给你发短信。你收到短信后决定怎么处理

电话号码就是回调函数——你提供给干洗店（chatStream），干洗店在合适的时候"回调"你。

### 回到我们的场景

```ts
// 没有 callback：chatStream 只能等全部读完再返回，打印不了中间过程
const reply = await chatStream(messages, config)
console.log(reply)  // 等 5 秒后一次性打印，没有打字机效果

// 有 callback：chatStream 每收到一段就调用你传的函数，你决定怎么处理
const reply = await chatStream(messages, config, (text) => {
  process.stdout.write(text)  // 每收到一段立刻打印
})
```

**你提供"怎么处理每段文本"的函数，chatStream 负责在合适的时候调用它。**

### TS 语法

```ts
// 参数类型：(text: string) => void
// 意思是：接收一个 string 参数，返回 void（不返回）
async function chatStream(
  messages: Message[],
  config: Config,
  onChunk: (text: string) => void,  // ← 回调函数的类型
): Promise<string> {
  // ...
  if (content) {
    onChunk(content)  // 调用回调，把文本传出去
  }
  // ...
}
```

调用时有两种写法：

```ts
// 写法 1：传一个箭头函数（最常见）
await chatStream(messages, config, (text) => {
  process.stdout.write(text)
})

// 写法 2：先定义函数，再传进去（效果一样）
function printChunk(text: string) {
  process.stdout.write(text)
}
await chatStream(messages, config, printChunk)
```

> Python 类比：
> ```python
> # 写法 1：传 lambda
> chat_stream(messages, config, lambda text: print(text, end=""))
>
> # 写法 2：先定义函数，再传进去
> def print_chunk(text):
>     print(text, end="")
> chat_stream(messages, config, print_chunk)
> ```

### 回调的价值：灵活性

同一个 chatStream，调用者可以决定每段文本怎么处理：

```ts
// 场景 1：打印到终端
await chatStream(messages, config, (text) => {
  process.stdout.write(text)
})

// 场景 2：存到数组（不打印）
const chunks: string[] = []
await chatStream(messages, config, (text) => {
  chunks.push(text)
})

// 场景 3：既打印又存
await chatStream(messages, config, (text) => {
  process.stdout.write(text)
  chunks.push(text)
})
```

chatStream 不关心你怎么处理文本，它只负责"收到一段就调你传的函数"。**处理逻辑由调用者决定，不是写死在函数里。**

## 封装 chatStream

看 [`src/llm.ts`](../../../src/llm.ts) 里新增的 `chatStream` 函数：

```ts
// 流式调 LLM API：逐块返回文本，最后返回完整文本
export async function chatStream(
  messages: Message[],
  config: { baseURL: string; apiKey: string; modelID: string },
  onChunk: (text: string) => void,
): Promise<string> {
  const response = await fetch(`${config.baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.modelID,
      stream: true,  // ← 关键：开启流式
      messages,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`API 错误 ${response.status}: ${errorText}`)
  }

  const decoder = new TextDecoder()
  let fullText = ""

  for await (const chunk of response.body!) {
    const text = decoder.decode(chunk, { stream: true })

    for (const line of text.split("\n")) {
      if (!line.startsWith("data: ")) continue

      const data = line.slice(6)
      if (data === "[DONE]") continue

      const json = JSON.parse(data)
      const content = json.choices[0]?.delta?.content
      if (content) {
        onChunk(content)     // 交给调用者处理（比如打印）
        fullText += content  // 收集完整文本
      }
    }
  }

  return fullText
}
```

和阶段 1 的 `chat()` 对比：

| | `chat()`（阶段 1） | `chatStream()`（本课） |
|---|-------------------|----------------------|
| 请求 | `stream: false`（默认） | `stream: true` |
| 读响应 | `await response.json()` | `for await (const chunk of response.body)` |
| 返回 | 一次性返回完整文本 | 过程中调回调打印，最后返回完整文本 |
| 用户体验 | 等 5 秒，一次性看到 | 逐字打印 |

## 集成到多轮对话

修改 [`src/index.ts`](../../../src/index.ts)，把 `chat()` 换成 `chatStream()`：

```ts
// 阶段 1（非流式）：
const reply = await chat(messages, config)
console.log("AI:", reply)

// 阶段 2（流式）：
process.stdout.write("AI: ")  // 先打印前缀
const reply = await chatStream(messages, config, (text) => {
  process.stdout.write(text)  // 逐字打印
})
console.log()  // 回复结束，换行
```

关键变化：
1. 先打印 `"AI: "` 前缀（不换行）
2. `chatStream` 过程中，回调函数逐字打印 AI 的回复
3. 回复结束后换行
4. `reply` 是完整文本，照常加入 messages 历史

## 跑起来

```bash
bun run src/index.ts
```

交互过程：

```
AI 助手已启动，输入问题开始对话（Ctrl+C 退出）
你: 什么是闭包？
AI: 闭包是指一个函数能够访问并记住其定义时的外部作用域中的变量。
你: 再举个例子
AI: 比如计数器函数...
```

你会看到 AI 的回复逐字打印出来，像打字机一样。

## 本课小结

1. **回调函数**：把函数当参数传，让被调者"回调"它（类比 Python 的 `Callable`）
2. **chatStream**：封装了流式 fetch + SSE 解析，通过回调逐块输出，最后返回完整文本
3. **集成多轮对话**：用 `process.stdout.write` 逐字打印，完整文本照常加入 messages 历史
4. **stream: true**：请求时开启流式，这是和阶段 1 的核心区别

下一步：[2.4 阶段验收](../04-stage-review/01-stage-review.md) —— 验收 + 工程思维总结。
