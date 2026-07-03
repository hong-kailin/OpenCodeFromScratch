# 1.2 HTTP 请求基础

> 本课目标：搞懂 HTTP 请求是什么，理解 URL/Method/Headers/Body 四个部分，为调 LLM API 打基础。

## HTTP 请求是什么

你用浏览器打开一个网页，背后发生的事是：

1. 你的电脑向服务器发一个**请求**："我要看这个页面"
2. 服务器返回一个**响应**：网页的 HTML 内容

这就是 HTTP 请求。LLM API 也是这个原理——你的程序向 LLM 服务器发请求"帮我回答这个问题"，服务器返回 AI 的回复。

## 请求的四个部分

一个 HTTP 请求有四个部分，用 curl 命令对照看最直观：

```bash
curl https://ark.cn-beijing.volces.com/api/coding/v3/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ark-你的apiKey" \
  -d '{"model": "deepseek-v4-flash", "messages": [...]}'
```

| 部分 | curl 里 | 含义 | Python 类比 |
|------|---------|------|-------------|
| **URL** | `https://ark.../chat/completions` | 请求发给谁 | `requests.post("url")` 的 url |
| **Method** | `curl` 默认 GET，`-d` 让它变 POST | 请求类型，POST 是"我要提交数据" | `requests.post()` 的 post |
| **Headers** | `-H "Authorization: Bearer xxx"` | 请求的附加信息，这里传 apiKey 做鉴权 | `requests.post(headers={...})` |
| **Body** | `-d '{"model": ...}'` | 提交的数据，告诉 LLM 用什么模型、说什么话 | `requests.post(json={...})` |

### URL

URL 就是"地址"——告诉请求发给哪个服务器、哪个接口。类比你去快递寄东西，URL 就是收件地址。

```
https://ark.cn-beijing.volces.com/api/coding/v3/chat/completions
└─────────── 域名 ──────────────┘└──────── 路径 ──────────┘
```

- **域名**（`ark.cn-beijing.volces.com`）：哪台服务器，类比收件人小区
- **路径**（`/api/coding/v3/chat/completions`）：服务器上的哪个接口，类比小区里几号楼几室

### Method（请求方法）

常见的两种：

| Method | 含义 | 类比 |
|--------|------|------|
| **GET** | 获取数据 | "给我看看" |
| **POST** | 提交数据 | "帮我处理这个" |

调 LLM API 用 POST——因为你要提交消息数据（问什么问题、用什么模型），不是单纯获取数据。

### Headers（请求头）

Headers 是请求的"附加信息"，键值对形式。调 LLM API 最重要的两个：

- `Content-Type: application/json`：告诉服务器"我发的是 JSON 数据"
- `Authorization: Bearer ark-xxx`：鉴权——"我是 ark-xxx 这个 key 的主人，让我用"

> 类比 Python：`requests.post(headers={"Authorization": "Bearer xxx"})`。Headers 就像寄快递时填的"备注"栏。

### Body（请求体）

Body 是你提交的数据，调 LLM API 时就是 JSON 格式的消息：

```json
{"model": "deepseek-v4-flash", "messages": [{"role": "user", "content": "你好"}]}
```

## 响应的三个部分

服务器返回的响应也有结构：

| 部分 | 含义 | 例子 |
|------|------|------|
| **状态码** | 请求成功还是失败 | 200 成功、401 鉴权失败、429 限流 |
| **Headers** | 响应的附加信息 | `Content-Type: application/json` |
| **Body** | 实际返回的数据 | AI 的回复（JSON 格式） |

> Python 类比：`response.status_code`（状态码）、`response.json()`（body）。你用 `requests` 时 `.status_code == 200` 表示成功，`.json()` 拿到返回数据。

### 状态码

| 状态码 | 含义 | 类比 |
|--------|------|------|
| **2xx** | 成功 | 200 OK |
| **4xx** | 你的请求有问题 | 401 没权限、404 找不到、400 参数错 |
| **5xx** | 服务器出了问题 | 500 内部错误 |

## 为什么用 JSON

请求 body 和响应 body 都是 JSON 格式（`{"key": "value"}`）。JSON 就是文本形式的结构化数据，类比 Python 的字典。程序发请求时把数据序列化成 JSON 字符串传过去，收到响应后把 JSON 字符串解析回字典。

```python
# Python 里的字典
data = {"model": "deepseek-v4-flash", "messages": [...]}

# 序列化成 JSON 字符串（发给服务器）
import json
json_string = json.dumps(data)  # '{"model": "deepseek-v4-flash", "messages": [...]}'

# 从 JSON 字符串解析回字典（收到响应后）
response_data = json.loads(response_text)
```

## 本课小结

你学会了：

1. **HTTP 请求**：客户端发请求 → 服务器返回响应，浏览器打开网页就是这个原理
2. **请求四部分**：URL（发给谁）、Method（GET 取 / POST 提交）、Headers（鉴权等附加信息）、Body（提交的数据）
3. **响应三部分**：状态码（成功/失败）、Headers、Body（返回的数据）
4. **JSON**：文本形式的结构化数据，类比 Python 字典，用于请求和响应的数据传输

下一步：[1.2 messages 结构与 curl 实操](./02-messages-curl.md) —— 用这些知识调 LLM API。
