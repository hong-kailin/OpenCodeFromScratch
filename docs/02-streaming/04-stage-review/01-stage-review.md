# 2.4 阶段验收：打字机效果 + 工程思维总结

> 本课目标：验收阶段 2 的成果，总结工程思维，对照 opencode 看流式实现的差距。

## 验收清单

```bash
# 1. 类型检查通过
bun run typecheck

# 2. 流式多轮对话能跑
bun run src/index.ts
# 输入 "1+1=?" → AI 逐字打印 "2"
# 输入 "再加3"  → AI 逐字打印 "5"（记得上下文）

# 3. 流式演示代码能跑
bun run src/stream-demo.ts
# 逐字打印 AI 回复
```

| 验收项 | 状态 |
|--------|------|
| SSE 格式理解（data: {JSON}\n\n、[DONE]） | ✓ |
| stream: true 开启流式 | ✓ |
| fetch 读 ReadableStream（for await） | ✓ |
| TextDecoder 解码字节 | ✓ |
| SSE 解析（提取 delta.content） | ✓ |
| 回调函数（onChunk） | ✓ |
| chatStream 封装 | ✓ |
| 多轮对话 + 逐字打印 | ✓ |

## 项目结构

阶段 2 新增/修改的文件：

```
src/
├── index.ts          # 修改：chat → chatStream，逐字打印
├── llm.ts            # 修改：新增 chatStream() 流式函数
└── stream-demo.ts    # 新增：流式读取演示
```

## 对照 opencode：我们的 vs 真实版

我们的 `chatStream()`：

```ts
// 简化版：原生 fetch + ReadableStream
async function chatStream(messages, config, onChunk): Promise<string> {
  const response = await fetch(url, { body: JSON.stringify({ stream: true, ... }) })
  for await (const chunk of response.body) {
    // 解析 SSE，提取 delta.content
    onChunk(content)
    fullText += content
  }
  return fullText
}
```

opencode 的流式（`packages/opencode/src/session/llm.ts`）：

```ts
// 真实版：Effect Stream + 多层抽象
const stream = (input) =>
  Stream.scoped(
    Stream.unwrap(
      Effect.gen(function* () {
        const ctrl = yield* Effect.acquireRelease(...)  // AbortController
        const result = yield* run({ ...input, abort: ctrl.signal })
        if (result.type === "native") return result.stream  // native 路径
        return Stream.fromAsyncIterable(result.result.fullStream)  // AI SDK 路径
      }),
    ),
  )
```

差距和原因：

| | 我们的 | opencode 的 | 为什么 opencode 更复杂 |
|---|--------|-------------|----------------------|
| 流式读取 | `for await (chunk of response.body)` | Effect Stream | 支持取消、错误恢复、流式组合 |
| SSE 解析 | 手动 split + startsWith | Framing.sse + Protocol 状态机 | 处理跨 chunk 边界、多 provider 格式 |
| 事件类型 | 只有 text（delta.content） | 16 种 LLMEvent（text、reasoning、tool-call 等） | 支持工具调用、推理过程、usage |
| 取消机制 | 无 | AbortController + Effect scope | 用户中断时立刻停止 |
| 错误处理 | throw new Error | Effect typed error | 不同错误类型走不同恢复策略 |

**我们不急着补这些**——后续阶段会逐步引入：

- 阶段 3（工具循环）：引入 tool-call 事件，LLM 可以调用工具
- 阶段 5（Session 持久化）：引入 Effect 管理副作用
- 后续：引入 AbortController 支持取消

## 工程思维总结

### 1. 流式是默认行为，不是可选功能

opencode 始终用 `stream: true`，不允许关掉。为什么？因为流式不只是"体验好"，它还是 agent 的基础：

- **工具调用**：LLM 在流式过程中返回 tool-call 事件，agent 需要实时处理
- **取消**：流式可以随时中断（AbortController），非流式只能等完
- **超时**：流式可以检测"多久没收到数据"，非流式只能设总超时

> 工程思维：**流式不是优化，是架构选择**。从一开始就基于流式设计，后续加工具调用、取消等功能时不用重构。

### 2. 回调函数：分离"数据生产"和"数据处理"

`chatStream` 通过回调函数 `onChunk` 把"收到文本"和"怎么处理文本"分开：

- `chatStream` 只负责：发请求、读流、解析 SSE、提取文本
- 调用者决定：打印到终端？存到文件？发到 UI？

> 工程思维：**关注点分离**。数据的生产者不需要知道消费者怎么用数据。opencode 也是这个思路——LLM 层产生 `LLMEvent` 流，session 层决定怎么处理（打印、持久化、转发给 UI）。

### 3. 先跑通再处理边界情况

我们的 SSE 解析是简化版——假设一个 chunk 包含完整的 SSE 行。实际上 chunk 边界可能把一行拆成两半。我们没有处理这个，因为：

1. 大多数情况下能跑通（服务器通常按 SSE 块边界发送）
2. 先跑通核心流程，再处理边界情况
3. 后续引入 Effect Stream 时会用 `Framing.sse` 自动处理

> 工程思维：**先求通，再求全**。不要一上来就处理所有边界情况，先让核心流程跑通。

## 阶段 2 学了什么

| 课 | 知识点 |
|----|--------|
| 2.1 | 流式 vs 非流式、SSE 格式（data: {JSON}\n\n、delta、[DONE]） |
| 2.2 | response.body、for await 异步遍历、TextDecoder、SSE 解析四步 |
| 2.3 | 回调函数、chatStream 封装、集成多轮对话、process.stdout.write |

你现在是"能流式对话"的状态。AI 回复逐字打印，多轮对话有上下文。下一步要让它真正变成 agent——能读文件、执行命令。

---

下一步：[阶段 3：工具循环](../../03-tool-loop/) —— Agent 的核心，LLM 能调用工具。
