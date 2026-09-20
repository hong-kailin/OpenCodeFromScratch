# 17.3 补充：读懂 Auth demo

> 对照代码：[auth-demo.ts](../../../packages/core/src/provider/auth-demo.ts)

这个普通 TypeScript 程序不发送网络请求。它准备一份基础 Headers，应用 Bearer Auth，然后比较
变换前后的值。

## 直接运行

```bash
bun run packages/core/src/provider/auth-demo.ts
```

预期输出：

```text
应用 Auth 前:
  Content-Type: application/json
  Authorization: null

应用 Auth 后:
  Content-Type: application/json
  Authorization: Bearer demo-token

Bearer Auth demo 通过
```

## `Headers` 是什么

```ts
const baseHeaders = new Headers({
  "Content-Type": "application/json",
})
```

`Headers` 是 Web 标准对象，Bun 和浏览器都提供。它比普通 JavaScript object 更贴近 HTTP 规则：
header 名称不区分大小写，并提供 `get`、`set`、`has` 等方法。`fetch` 可以直接接收它。

读取不存在的 header 时，`get` 返回 `null`：

```ts
baseHeaders.get("Authorization") // null
```

它不是 Python 字典的 `KeyError`，也不是 JavaScript 常见的 `undefined`。因此 demo 用 `!== null`
判断原始 Headers 是否被意外修改。

## 两步创建和应用 Auth

```ts
const auth = bearerAuth("demo-token")
const authenticatedHeaders = auth.apply(baseHeaders)
```

第一行配置认证策略，第二行把策略应用到一次请求。拆成两步后，同一个 Auth 可以用于多次请求，
调用方也不需要反复拼接 `Bearer ` 前缀。

`demo-token` 是教学用假值。真实 API key 来自配置，项目代码不会把它打印出来。

## 为什么比较两个 Headers

demo 最后检查三个结果：

```ts
baseHeaders.get("Authorization") === null
authenticatedHeaders.get("Content-Type") === "application/json"
authenticatedHeaders.get("Authorization") === "Bearer demo-token"
```

第一项证明 Auth 没修改输入对象；第二项证明复制时保留了基础 header；第三项证明认证信息正确加入。
任何一项不成立都会 `throw new Error(...)`，Bun 会打印错误堆栈并以非零状态退出。

## 在哪里加断点

如果输出和预期不同，可以在 [auth.ts](../../../packages/core/src/provider/auth.ts) 的
`const authenticated = new Headers(headers)` 处加断点，观察：

1. 输入 `headers` 中有哪些值；
2. 复制后的 `authenticated` 是否保留 Content-Type；
3. 执行 `.set(...)` 后 Authorization 是否出现；
4. 返回后 `baseHeaders` 是否仍保持原样。

这一调试路径只涉及内存对象，不依赖 API 服务是否在线，也不会消耗模型额度。
