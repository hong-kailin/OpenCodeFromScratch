# 17.4.4 运行完整 Protocol demo

> 对照代码：[protocol-demo.ts](../../../packages/core/src/provider/protocol-demo.ts)

一个 Protocol 同时拥有请求和响应两个方向，所以 demo 也合并成一次完整运行。它不访问网络，不消耗
模型额度。

## 直接运行

```bash
bun run packages/core/src/provider/protocol-demo.ts
```

输出分为两部分：

```text
=== 请求方向：LLMRequest -> OpenAI Chat Body ===
...
请求方向通过

=== 响应方向：OpenAI Chat Frame -> LLMEvent ===
...
响应方向通过

OpenAI Chat Protocol 双向 demo 通过
```

## 请求方向观察什么

demo 先构造通用 `LLMRequest`，再执行：

```ts
const body = openAIChatProtocol.encodeRequest(request)
```

重点观察 `modelID` 变成 `model`，完整 `Tool` 变成 OpenAI function tool，而 `execute` 函数没有进入
请求 Body。

demo 中的工具仍必须提供 `execute`，因为项目内部 `Tool` 类型要求它。这里返回空字符串 Effect，
只是构造一份类型完整的教学输入，不会真正执行工具。

## 响应方向观察什么

固定的四个字符串模拟 Framing 已切好的 payload，其中工具参数故意拆成两帧。处理每帧时：

```ts
const vendorEvent = openAIChatProtocol.response.decodeFrame(frame)
const result = openAIChatProtocol.response.step(state, vendorEvent)
state = result.state
llmEvents.push(...result.llmEvents)
```

`llmEvents.push(...items)` 类似 Python 的 `events.extend(items)`。所有 frame 结束后，再调用：

```ts
llmEvents.push(...openAIChatProtocol.response.finish(state))
```

此时才会得到 arguments 为 `{"path":"README.md"}` 的完整工具调用。

## 怎样观察状态机

在 `step` 前后加日志：

```ts
console.log("旧状态", state)
const result = openAIChatProtocol.response.step(state, vendorEvent)
console.log("新状态", result.state)
```

重点看 index `0` 的 `arguments` 怎样从 `{"path":` 变成完整 JSON。参数重复或缺字时检查 `step`；
没有完整 frame 时检查 Framing。

## 怎样读 Schema 错误

demo 最后故意传入合法 JSON、错误结构：

```json
{"choices":"不是数组"}
```

- `SyntaxError`：JSON 字符串本身不完整或语法错误；
- Schema 错误：JSON 能解析，但结构不符合当前 Protocol；
- Schema 通过但通用事件错误：进入 `step` 检查 state 和 llmEvents。

这种分层排查可以区分“流切坏了”“厂商格式变了”和“状态机拼错了”。demo 末尾的普通 `if` 检查
负责在结果不符合预期时抛出 Error；当前课程还没有引入 TS 测试框架，因此继续使用可直接运行的脚本。
