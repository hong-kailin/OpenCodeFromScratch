# 2.1 流式输出是什么：SSE 格式

> 本课目标：理解流式输出和非流式的区别，用 curl 手动调一次流式 API，看清 SSE 格式长什么样。

## 非流式的问题

阶段 1 我们的 `chat()` 函数是这样工作的：

```
用户输入问题 → 发请求 → 等 5 秒 → AI 全部生成完 → 一次性返回 → 打印
```

问题：用户要盯着空白屏幕等 5 秒，不知道程序是卡住了还是在思考。

流式输出改成：

```
用户输入问题 → 发请求 → AI 生成第一个字 → 立刻打印
                      → AI 生成第二个字 → 立刻打印
                      → ...逐字打印...
                      → AI 生成完 → 结束
```

就像打字机一样，用户立刻看到 AI 在"说话"，体验好很多。

> 你用 ChatGPT 时看到回复一个个字蹦出来，就是流式输出。

## 流式和非流式的区别

请求时只加一个参数 `"stream": true`：

| | 非流式（阶段 1） | 流式（本阶段） |
|---|-----------------|---------------|
| 请求 body | `{"model": "...", "messages": [...]}` | `{"model": "...", "messages": [...], "stream": true}` |
| 响应格式 | 一个完整 JSON | 多个 SSE 数据块 |
| 用户等待 | 等 5 秒，一次性看到全部 | 立刻开始看到内容，逐字出现 |

请求几乎一样，就多了 `"stream": true`。但响应格式完全不同。

## SSE 格式

流式响应用的是 **SSE（Server-Sent Events）** 格式。本质就是：服务器把响应拆成多个小块，每块用 `data: ` 前缀 + 两个换行分隔。

非流式响应是一个完整 JSON：

```json
{
  "choices": [
    {"message": {"role": "assistant", "content": "闭包是函数加上它引用的外部变量。"}}
  ]
}
```

流式响应是多个小 JSON，每个是一小段文本：

```
data: {"choices":[{"delta":{"content":"闭"},"finish_reason":null}]}

data: {"choices":[{"delta":{"content":"包"},"finish_reason":null}]}

data: {"choices":[{"delta":{"content":"是"},"finish_reason":null}]}

data: {"choices":[{"delta":{"content":"函数"},"finish_reason":null}]}

data: {"choices":[{"delta":{},"finish_reason":"stop"}]}

data: [DONE]
```

几个要点：

1. **`data: ` 前缀**：每个块以 `data: ` 开头，后面跟 JSON
2. **两个换行分隔**：每个块之间用空行（两个 `\n`）隔开
3. **`delta` 代替 `message`**：非流式用 `message.content`，流式用 `delta.content`（增量）
4. **`[DONE]` 结束**：最后一个块是 `data: [DONE]`，表示流结束
5. **每个 delta 只有一小段**：一个字、一个词、一句话都可能，取决于服务器怎么拆

### delta 和 message 的区别

| | 非流式 | 流式 |
|---|--------|------|
| 字段 | `choices[0].message.content` | `choices[0].delta.content` |
| 内容 | 完整回复 | 一小段文本（增量） |
| 拿完整回复 | 直接用 | 把所有 delta.content 拼接起来 |

> 类比：非流式像收快递——等包裹全部到了一次性拆开；流式像看直播——主播说一句你听一句。

## 用 curl 手动调一次

用 curl 调流式 API，加 `--no-buffer` 让 curl 不缓冲输出（否则你看不到逐块返回的效果）：

```bash
curl --no-buffer https://ark.cn-beijing.volces.com/api/coding/v3/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ark-你的apiKey" \
  -d '{
    "model": "deepseek-v4-flash",
    "stream": true,
    "messages": [
      {"role": "system", "content": "你是一个简洁的助手，用中文回答"},
      {"role": "user", "content": "什么是闭包？一句话解释"}
    ]
  }'
```

> 把 `ark-你的apiKey` 换成你 `opencode.json` 里的 apiKey。

你会看到内容一块一块地出现：

```
data: {"id":"chatcmpl-xxx","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}

data: {"id":"chatcmpl-xxx","choices":[{"index":0,"delta":{"content":"闭"},"finish_reason":null}]}

data: {"id":"chatcmpl-xxx","choices":[{"index":0,"delta":{"content":"包"},"finish_reason":null}]}

data: {"id":"chatcmpl-xxx","choices":[{"index":0,"delta":{"content":"是函数及其引用的外部变量的组合。"},"finish_reason":null}]}

data: {"id":"chatcmpl-xxx","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}

data: [DONE]
```

观察现象：

1. 第一个 delta 的 `content` 是空字符串（先告诉你"我是 assistant"）
2. 中间的 delta 每次带一小段 `content`（有时一个字，有时几个字）
3. 倒数第二个 delta 的 `content` 为空，但 `finish_reason: "stop"`（告诉你要结束了）
4. 最后是 `data: [DONE]`（流结束标记）

**我们要做的事**：在 TS 代码里逐块读取这些 SSE 数据，提取 `delta.content`，立刻打印到终端。

## 对照 opencode

opencode **始终用流式**——它的所有请求都硬编码了 `stream: true`：

```ts
// opencode/packages/llm/src/protocols/openai-chat.ts:359
stream: true as const,
stream_options: { include_usage: true },  // 流式末尾带 token 用量
```

opencode 甚至不允许用户通过配置关掉流式——`stream` 字段在禁止覆盖的黑名单里。

> opencode 用 Effect Stream 处理 SSE（后续阶段会引入 Effect）。我们先用 TS 原生的 ReadableStream，简单直接，后续再引入 Effect。

## 本课小结

1. **流式 vs 非流式**：非流式等全部生成完，流式逐字返回，用户体验更好
2. **请求区别**：只多了 `"stream": true`
3. **SSE 格式**：`data: {JSON}\n\n`，每块是一个小 JSON，`data: [DONE]` 结束
4. **delta 代替 message**：流式用 `choices[0].delta.content`（增量），拼接起来就是完整回复
5. **opencode 始终用流式**：`stream: true` 硬编码，不允许关掉

下一步：[2.2 用 fetch 读流式响应](../02-fetch-stream/01-fetch-stream.md) —— 用 TS 代码逐块读取 SSE。
