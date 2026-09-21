# 17.5 Route：独立的零件还需要一个装配点

> 配套代码：
> [route.ts](../../../packages/core/src/provider/route.ts)、
> [openai-chat-route.ts](../../../packages/core/src/provider/openai-chat-route.ts)、
> [openai.ts](../../../packages/core/src/provider/openai.ts)

前四节已经分别抽出了 Framing、Endpoint、Auth 和 Protocol。它们都能独立测试，但
`createOpenAIProvider` 仍然亲自导入并排列四个零件。

## 当前具体问题是什么

修改前，Provider 的请求侧这样写：

```ts
const url = renderEndpoint(endpoint)
const headers = auth.apply(baseHeaders)
const body = openAIChatProtocol.encodeRequest(request)
```

响应侧又这样写：

```ts
const frames = sseFraming.frame(byteStream)
const event = openAIChatProtocol.response.decodeFrame(frame)
const result = openAIChatProtocol.response.step(state, event)
```

每个零件本身已经解耦，但**谁与谁组合、以什么顺序调用**仍然写在 Provider 中。接入 Codex 时如果再
写一套类似流程，就可能漏掉 `finish`、先应用 Auth 再构造 URL，或者把某个 Framing 接给不匹配的
Protocol。

这和把四个算法函数分别写好，却在每个业务入口重复手写同一条 pipeline 类似。零件独立只解决了
“可以替换”，还需要 Route 解决“怎样装配”。

## Route 表达一条完整路线

```ts
export interface MakeRouteInput<Body, Frame, Event, State> {
  readonly id: string
  readonly protocol: Protocol<Body, Frame, Event, State>
  readonly endpoint: Endpoint
  readonly auth: Auth
  readonly framing: Framing<Frame>
}
```

`makeRoute` 的泛型把两个关键连接检查出来：

- `Framing<Frame>` 输出的 Frame 必须正好能交给 Protocol；
- Protocol 自己的 Body、Event、State 必须前后一致。

调用方不需要手写这些泛型。传入 `sseFraming` 和 `openAIChatProtocol` 后，TypeScript 会推导
`Frame = string`。如果把输出二进制对象的 Framing 接给只接收字符串的 Protocol，类型检查会报错。

## 为什么 Route 对外只有两个动作

```ts
interface Route {
  readonly prepare: (request: LLMRequest) => PreparedRouteRequest
  readonly events: (bytes: Stream<Uint8Array, LLMError>) => Stream<LLMEvent, LLMError>
}
```

请求侧的 `prepare` 依次完成：

```text
LLMRequest -> Protocol Body -> JSON 字符串
Endpoint   -> URL
Auth       -> Headers
```

响应侧的 `events` 完成：

```text
字节流 -> Framing -> Frame -> Protocol 状态机 -> LLMEvent
```

这样 Provider 不再操作四个零件，只负责中间稳定的 HTTP 调用，并把通用事件累积成旧接口需要的
`ChatResult`。

## 一条具体 Route 在哪里定义

```ts
return makeRoute({
  id: "openai-chat",
  protocol: openAIChatProtocol,
  endpoint,
  auth: bearerAuth(config.apiKey),
  framing: sseFraming,
})
```

这段代码位于 `openai-chat-route.ts`。它是一张装配清单：看到这里就能知道当前路线说什么协议、发往
哪里、怎样认证、怎样分帧。Provider 只调用 `createOpenAIChatRoute(config)`。

## State 为什么必须在 events 内创建

```ts
events: (bytes) => {
  return Stream.suspend(() => {
    let state = protocol.response.initial()
    // ...处理本次响应
  })
}
```

Route 对象可以被多次甚至并发调用。如果把 state 放在 Route 外层，两个请求会共享工具参数片段：
请求 A 的半截 arguments 可能拼到请求 B。这是一类典型的共享可变状态 bug。

把 state 放进 `Stream.suspend`，相当于 Python 中每次实际迭代生成器时都创建自己的局部
accumulator。即使同一个 Stream 被运行两次，两次状态也互不影响。

## 为什么需要 Stream.suspend

工具调用要在流结束后执行 `finish(state)`。但 Stream 是惰性的：定义 pipeline 时还没有处理任何
frame。如果立刻调用 `finish`，只能读到初始空状态。

```ts
const finished = Stream.suspend(() =>
  Stream.fromIterable(protocol.response.finish(state)),
)
```

这里有两层 `Stream.suspend`：外层把 State 的创建推迟到每次 Stream 运行时；内层把 `finish` 推迟到
前面的 frame 真正结束以后，此时 state 才包含完整工具参数。

## 当前简化版与真实 opencode

真实实现位于 `opencode/packages/llm/src/route/client.ts`。它的 `Route.make` 除四轴外还接入 Transport，
把 HTTP、WebSocket、重试和执行器也从 Provider 移走。

本节先保留 `fetch` 在 Provider，只让 Route 负责编译请求和翻译响应。当前只有一种 HTTP JSON 传输，
此时引入完整 Transport 会掩盖四轴组合这个核心问题；后续拆出 `packages/llm` 时再继续对齐真实结构。
