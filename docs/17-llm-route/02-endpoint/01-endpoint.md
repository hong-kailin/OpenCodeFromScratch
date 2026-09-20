# 17.2 抽出 Endpoint：把“发到哪里”单独表达

> 配套代码：
> [endpoint.ts](../../../packages/core/src/provider/endpoint.ts)、
> [endpoint-demo.ts](../../../packages/core/src/provider/endpoint-demo.ts)、
> [openai.ts](../../../packages/core/src/provider/openai.ts)

17.1 已把响应字节的边界交给 Framing。这一节只看请求的另一端：**URL 从哪里来。**

## 当前代码混合了两种来源

修改前，Provider 在调用 `fetch` 时直接拼字符串：

```ts
const response = await fetch(`${config.baseURL}/chat/completions`, {
```

一行很短，但两部分有不同的变化原因：

| 部分 | 来自哪里 | 为什么会变 |
|---|---|---|
| `config.baseURL` | 用户选择的部署配置 | 火山、OpenAI、代理服务的域名和前缀不同 |
| `/chat/completions` | 当前调用路线 | Chat Completions 与 Responses 使用不同 path |

当前 Provider 既读取部署地址，又知道路线 path，还负责处理两者之间的 `/`。这会产生三个具体问题：

1. 配置写成 `https://example.com/v1/` 时，字符串拼接得到 `.../v1//chat/completions`；
2. 只想换 path，也必须进入 `chatWithTools` 的 HTTP 代码修改；
3. debug 日志和 `fetch` 各拼一次 URL，未来可能改了一处却漏掉另一处。

## 希望得到的边界

Endpoint 是一份只描述地址的数据：

```ts
export interface Endpoint {
  readonly baseURL: string
  readonly path: string
}
```

它不保存 API key，不构造请求 body，也不解释响应。当前只加入真实需要的 `baseURL` 和 `path`；
参考源码还支持动态 path 与 query，等项目遇到对应问题时再补。

这里的 `readonly` 只禁止重新赋值字段。它表达 Endpoint 创建后就是一份稳定配置，调用过程中不应
偷偷改变。可以类比 Python 中把配置对象当作不可变 dataclass 使用。

## 统一渲染 URL

```ts
export function renderEndpoint(endpoint: Endpoint): URL {
  const baseURL = endpoint.baseURL.replace(/\/+$/, "")
  const path = endpoint.path.startsWith("/") ? endpoint.path : `/${endpoint.path}`

  return new URL(`${baseURL}${path}`)
}
```

这段函数先确定两个约束：

- baseURL 结尾不保留 `/`；
- path 开头一定有一个 `/`。

因此无论配置写不写尾部斜杠，都会得到同一个结果。最后返回 Web 标准的 `URL` 对象，而不是普通
字符串；`URL` 会校验基本结构，`fetch` 也可以直接接收它。

`renderEndpoint` 是纯函数：相同 Endpoint 总得到相同 URL，没有读取环境变量或修改外部状态。
这使 URL 构造可以脱离网络单独运行和观察。

## Provider 现在怎样使用它

创建 Provider 时，先把配置与当前路线组合起来：

```ts
const endpoint: Endpoint = {
  baseURL: config.baseURL,
  path: "/chat/completions",
}
```

真正请求时只渲染一次，并让日志与 `fetch` 共用同一个对象：

```ts
const url = renderEndpoint(endpoint)
debug(`  POST ${url.toString()}`)
```

随后 `fetch` 直接接收同一个 `url`。现在替换部署地址只改 `baseURL`，替换路线地址只改 `path`，
斜杠规则只存在于 `renderEndpoint`。Agent loop、认证 header、请求 body 和 SSE 响应解析都没有变化。

## Endpoint 没有解决什么

拆出边界不等于整个 Route 已经完成：

- `Authorization: Bearer ...` 仍写在 Provider 中，那是 Auth 的问题；
- `model / messages / tools` 仍在这里转换，那是 Protocol 的问题；
- Endpoint 目前仍由 OpenAI Provider 创建，还没有 Route 负责组合四个轴。

这些保留项很重要：如果这一节顺手把它们一起重构，就无法判断行为变化来自哪个边界。

## 教 Debug：地址不对时从哪里查

1. 先运行 Endpoint demo，确认纯 URL 构造是否正确；
2. 开启项目 debug 日志，核对 `POST` 后打印的最终 URL；
3. 若 `new URL(...)` 抛出 `Invalid URL`，打印 `baseURL` 与 `path`，通常是配置缺少协议；
4. URL 正确但返回 404，再确认当前 Protocol 应该使用哪个 path。

运行验证：

```bash
bun run packages/core/src/provider/endpoint-demo.ts
bun run typecheck
```

预期三个场景均显示“结果符合预期”，TypeScript 类型检查通过。

## 对照真实 opencode

真实实现位于 `opencode/packages/llm/src/route/endpoint.ts`。它同样把 Endpoint 保存为数据，再用
`render` 生成 `URL`；额外支持根据请求 body 计算 path、合并 query 和覆盖默认配置。

我们目前只复制已经有具体需求的核心边界。下一份文档会逐段解释 Endpoint demo 的 TypeScript。
