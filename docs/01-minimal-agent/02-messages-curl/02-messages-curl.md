# 1.2 messages 结构与 curl 实操

> 本课目标：理解 LLM API 的 messages 结构，用 curl 手动调一次火山引擎 API 建立直观感受。

## LLM API 的本质

上一课我们搞懂了 HTTP 请求。现在套到 LLM API 上——**发 POST 请求（带 apiKey + 消息数据）→ 收到 JSON 响应（AI 的回复）**：

```python
# Python 版本，帮助你理解整个过程
import requests

response = requests.post(
    "https://ark.cn-beijing.volces.com/api/coding/v3/chat/completions",  # URL
    headers={                                                            # Headers（鉴权）
        "Content-Type": "application/json",
        "Authorization": "Bearer ark-xxx",
    },
    json={                                                               # Body（消息数据）
        "model": "deepseek-v4-flash",
        "messages": [
            {"role": "system", "content": "你是一个简洁的助手"},
            {"role": "user", "content": "什么是闭包？"}
        ]
    },
)

print(response.status_code)  # 200 表示成功
print(response.json())       # AI 的回复
```

没有黑魔法。就是发一个 POST 请求，body 里告诉它用哪个模型、说什么话，它返回 AI 的回复。

## messages 结构

OpenAI 兼容 API 的核心是 **messages 数组**——对话历史就是一组消息，每条消息有 `role`（角色）和 `content`（内容）：

```json
{
  "model": "deepseek-v4-flash",
  "messages": [
    {"role": "system", "content": "你是一个简洁的助手"},
    {"role": "user", "content": "什么是闭包？"}
  ]
}
```

三种角色：

| role | 谁说的 | 作用 | Python 类比 |
|------|--------|------|-------------|
| `system` | 系统指令 | 给 AI 设定角色、规则、限制 | 程序的配置/参数 |
| `user` | 用户 | 你问的问题 | `input()` 的内容 |
| `assistant` | AI | AI 之前的回复 | 函数返回值 |

### system prompt：给 AI 设定角色

`system` 消息是"开场指令"，告诉 AI 它是谁、该怎么做。比如：

```json
{"role": "system", "content": "你是一个 TypeScript 老师，回答简洁，用中文"}
```

> 对照 opencode：它的 system prompt 非常复杂——根据不同模型选不同 prompt（`opencode/packages/opencode/src/session/system.ts:26`），有 `gpt.txt`、`anthropic.txt`、`gemini.txt` 等多个 prompt 文件。但本质就是一条 system 消息，内容长一些而已。我们阶段 7 会实现 AGENTS.md 加载，到时再讲 opencode 怎么组装完整的 system prompt。

### 为什么是数组

messages 是数组，因为要维护**对话历史**。多轮对话时，每次请求都带上之前的所有消息：

```json
{
  "messages": [
    {"role": "system", "content": "你是助手"},
    {"role": "user", "content": "1+1=?"},
    {"role": "assistant", "content": "2"},
    {"role": "user", "content": "再加3呢？"}
  ]
}
```

AI 看到 "2" 是它自己之前说的，才能理解"再加3"是 2+3=5。**LLM 没有记忆，每次请求都是独立的——它"记住"对话靠的是你每次把历史消息都传过去。**

> 这是 agent 开发最核心的概念之一。opencode 的 session 系统（`session/message.ts`）本质就是在管理这个消息历史。

## 用 curl 手动调一次

上一课配置文件里的 baseURL 是 `https://ark.cn-beijing.volces.com/api/coding/v3`，OpenAI 兼容 API 的路径是 `/chat/completions`，拼起来就是完整 URL。

先用 curl 感受一下，不用写任何代码：

```bash
curl https://ark.cn-beijing.volces.com/api/coding/v3/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ark-你的apiKey" \
  -d '{
    "model": "deepseek-v4-flash",
    "messages": [
      {"role": "system", "content": "你是一个简洁的助手，用中文回答"},
      {"role": "user", "content": "什么是闭包？一句话解释"}
    ]
  }'
```

> 把 `ark-你的apiKey` 换成你 `opencode.json` 里的 apiKey。或者在终端先 `export API_KEY="ark-你的apiKey"`，然后写 `Bearer $API_KEY`。

你会收到类似这样的 JSON 响应：

```json
{
  "id": "chatcmpl-xxx",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "deepseek-v4-flash",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "闭包是函数连同其引用的外部变量的组合，调用时能访问那些外部变量。"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 30,
    "completion_tokens": 25,
    "total_tokens": 55
  }
}
```

关键看 `choices[0].message.content`——这就是 AI 的回复。其他字段：

- `id`：这次请求的 ID
- `model`：实际用的模型
- `finish_reason`：为什么停了（`stop` 是正常结束）
- `usage`：token 用量（类比 API 的计费量）

> 响应结构看起来复杂，但我们关心的就一个：`choices[0].message.content`。下一课写 TS 代码时也是提取这一个字段。

## 教 Debug：常见 API 报错

| HTTP 状态码 | 含义 | 原因 | 解决 |
|-------------|------|------|------|
| 401 | Unauthorized | apiKey 错或没传 | 检查 Authorization header 里的 key |
| 429 | Too Many Requests | 超出速率限制或余额不足 | 等一会 / 充值 |
| 400 | Bad Request | 请求参数错 | 检查 model 名、messages 格式 |
| 404 | Not Found | URL 拼错或 model 名不对 | 检查 baseURL 路径、model 名 |

报错时响应 body 会有详细信息：

```json
{"error": {"message": "Incorrect API key provided", "type": "invalid_request_error", "code": "invalid_api_key"}}
```

读 `error.message` 就知道什么问题了。类比 Python requests 的 `response.status_code` + `response.json()["error"]`。

## 本课小结

你学会了：

1. **LLM API 本质**：就是一个 POST 请求 + JSON 响应，和调任何 REST API 一样
2. **messages 结构**：`[{role, content}, ...]`，role 有 system/user/assistant
3. **system prompt**：给 AI 设定角色的开场指令
4. **对话历史**：LLM 没有记忆，每次请求要带上全部历史消息
5. **响应结构**：AI 回复在 `choices[0].message.content`
6. **常见报错**：401 鉴权、429 限流、400 参数、404 模型名

下一步：[1.3 用 fetch 调 API](../03-fetch-llm/01-fetch-basics.md) —— 用 TypeScript 代码读配置、发请求。
