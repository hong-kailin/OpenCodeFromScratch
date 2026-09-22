# 17.5 补充：运行 Route demo

> 对照代码：[route-demo.ts](../../../packages/core/src/provider/route-demo.ts)

demo 不访问网络。它先检查 Route 准备出的 HTTP 请求，再把模拟响应字节交给同一条 Route，观察最终
的通用事件。

## 直接运行

```bash
bun run packages/core/src/provider/route-demo.ts
```

预期最后看到：

```text
请求侧四轴装配通过
响应侧四轴装配通过
Route demo 通过
```

## 请求侧验证了哪三个轴

```ts
const prepared = route.prepare(request)
```

得到的 `PreparedRouteRequest` 包含：

| 结果 | 来自哪个轴 |
|---|---|
| `/v1/chat/completions` | Endpoint |
| `Authorization: Bearer demo-token` | Auth |
| model、messages、function tools | Protocol |

demo 用普通 `if` 分别检查这三项。失败信息会直接指出是哪条连接没有生效，比在真实网络请求中同时
排查 URL、401 和 body 更容易。

## 响应侧验证了哪两个轴

demo 把三条 OpenAI Chat SSE 事件和 `[DONE]` 编码成字节，再故意从任意位置切成四个 chunk：

```ts
const chunks = [
  bytes.slice(0, 31),
  bytes.slice(31, 97),
  bytes.slice(97, 181),
  bytes.slice(181),
]
```

这些位置不关心 JSON 或 UTF-8 边界，用来模拟真实网络。然后只调用：

```ts
route.events(Stream.fromIterable(chunks))
```

内部先由 Framing 恢复完整 SSE payload，再由 Protocol 校验 OpenAI event、翻译文本、拼接工具参数。
最终调用方只看到：

> 这些层次的完整区别见 [Event 到底是什么](../04-protocol/03-event.md)。

```text
text-delta("开始读取。")
tool-call(read, {"path":"README.md"})
```

## 为什么 demo 不 mock fetch

这一节验证的是四轴装配，不是 HTTP 客户端。直接喂入字节流可以把 DNS、网络、额度和服务端状态排除，
失败只可能来自 Route 的连接方式或某个轴本身。

Provider 的真实 `fetch` 调用仍由已有应用路径覆盖。等 Transport 成为独立边界时，再为“准备请求、
执行 HTTP、读取响应”建立对应的离线替身。

## Debug 顺序

如果 demo 失败，按数据流向定位：

1. URL 错误：打印 `prepared.url`，检查 Endpoint；
2. header 错误：打印 `prepared.headers`，检查 Auth；
3. body 错误：打印 `prepared.body`，检查 Protocol 请求方向；
4. 没有事件：先打印 Framing 输出；
5. frame 正确但事件错误：检查 Protocol 的 `decodeFrame / step / finish`。

Route 的价值不只是少写几行调用，而是让每个故障都有明确归属。
