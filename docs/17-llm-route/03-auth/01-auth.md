# 17.3 抽出 Auth：把“凭什么被接受”单独表达

> 配套代码：
> [auth.ts](../../../packages/core/src/provider/auth.ts)、
> [auth-demo.ts](../../../packages/core/src/provider/auth-demo.ts)、
> [openai.ts](../../../packages/core/src/provider/openai.ts)

17.2 已让 Endpoint 决定请求发往哪里。这一节继续看 `fetch` 中尚未拆开的另一部分：认证 header。

## HTTP header 到底是什么

一次 HTTP 请求可以先粗略看成三部分：请求行、headers、body。下面是一份便于理解的文本表示：

```text
POST /v1/chat/completions HTTP/1.1       ← 请求行：方法与 path
Host: api.example.com                    ← header：目标主机
Content-Type: application/json           ← header：body 的格式
Authorization: Bearer <token>            ← header：身份凭据
                                            空行：headers 到这里结束
{"model":"demo-model","stream":true}   ← body：真正提交的数据
```

header 是随请求发送的**元数据**，每一项都是 `名称: 值`。它通常描述服务器应该怎样理解或处理这次
请求，而不是承载 messages、tools 等业务数据。空行把 headers 与 body 分开。

`Content-Type` 告诉服务器 body 使用 JSON；`Authorization` 告诉服务器调用者是谁、拥有什么权限。
前者描述数据格式，后者描述身份，因此虽然都位于 headers 区域，却属于不同职责。

术语上，**header** 指其中一项，**headers** 指多项 header 组成的集合。TypeScript 的 `Headers`
是操作这个集合的 Web 标准对象，提供 `get`、`set`、`has` 等方法。

## 当前具体问题

修改前，OpenAI Provider 直接构造所有 headers：

```ts
headers: {
  "Content-Type": "application/json",
  Authorization: `Bearer ${config.apiKey}`,
},
```

这两行看起来都属于 headers，变化原因却不同：

| header | 它表达什么 | 谁决定它 |
|---|---|---|
| `Content-Type` | body 是 JSON | HTTP 请求格式 |
| `Authorization` | 当前请求的身份 | Auth 策略 |

Bearer API key 只是其中一种认证方式。Anthropic 使用 `x-api-key`；AWS SigV4 会根据 method、URL、body
动态签名；Codex 需要把当前可用的 OAuth access token 应用到请求。认证变化不应该迫使我们复制
Endpoint、请求 body 和 SSE 解析代码。

## 希望得到的边界

当前阶段只需要回答一个问题：**给定已有 headers，认证后应该得到什么 headers？**

```ts
export interface Auth {
  readonly apply: (headers: Headers) => Headers
}
```

用 Python 类型理解，大致是 `Callable[[Headers], Headers]`。Auth 不读取模型消息，不决定 URL，也不
执行 `fetch`。它只接收请求已有的 headers，返回加入身份信息后的 headers。

真实 opencode 的 Auth 输入还包括 method、URL 和 body，因为 SigV4 需要对完整请求签名；当前
Bearer Auth 用不到这些信息，所以先保持最小接口。等实际实现 SigV4 时再扩展，而不是现在预支复杂度。

## 实现 Bearer Auth

```ts
export function bearerAuth(token: string): Auth {
  return {
    apply: (headers) => {
      const authenticated = new Headers(headers)
      authenticated.set("Authorization", `Bearer ${token}`)
      return authenticated
    },
  }
}
```

`bearerAuth(token)` 创建一份 Auth。返回对象中的 `apply` 会记住传入的 token，这种函数记住外层变量
的能力叫 closure，类似 Python 内部函数引用外层函数的局部变量。

这里复制 `Headers` 后再修改，原因不是语法偏好，而是隔离副作用：调用者的基础 headers 保持不变，
同一份基础配置以后可以安全交给不同 Auth。`set` 还会覆盖已有的同名 header，避免出现两个
`Authorization` 值。

## Provider 现在怎样使用它

创建 Provider 时，把 API key 变成 Auth：

```ts
const auth = bearerAuth(config.apiKey)
```

每次请求先准备与 body 格式有关的基础 headers，再应用 Auth：

```ts
const headers = auth.apply(
  new Headers({
    "Content-Type": "application/json",
  }),
)
```

最后 `fetch` 只接收准备好的 `headers`。Provider 不再知道 Bearer 字符串怎样拼接；Endpoint、body、
错误处理和 Framing 都没有变化。

## Auth 与 OAuth 不是同一件事

Auth 是代码中的请求认证边界；OAuth 是取得和刷新访问凭据的一套协议。当前 `bearerAuth` 只实现了
前者，没有实现登录、过期检查或刷新。两者的完整含义和协作流程见
[Auth 与 OAuth 分别解决什么问题](./02-auth-and-oauth.md)。

## 教 Debug：检查认证但不要泄露凭据

1. 先运行 Auth demo，确认纯 header 变换是否正确；
2. 收到 401 时，检查是否存在 `Authorization`，不要把完整 token 打进日志；
3. 收到 403 时，header 可能正确但账号权限不足，需要看响应体表达的原因；
4. 若服务端要求 `x-api-key`，问题是选错 Auth 策略，不是 token 字符串拼接错误。

项目 debug 日志仍然只打印 URL、模型和工具数量，不打印认证 headers。demo 使用的是明确的假 token
`demo-token`，因此可以安全展示完整结果。

运行验证：

```bash
bun run packages/core/src/provider/auth-demo.ts
bun run typecheck
```

预期看到 Auth 应用前没有 Authorization，应用后得到 `Bearer demo-token`，并保留 Content-Type。

## 对照真实 opencode

真实实现位于 `opencode/packages/llm/src/route/auth.ts`。它在相同 `apply` 核心之上增加了 Effect、
Redacted、环境配置、缺失凭据错误，以及 `andThen` / `orElse` 组合。我们先保留当前需求能证明的
最小边界；后续接入 OAuth 时，再让“为什么需要异步凭据”从真实问题中出现。
