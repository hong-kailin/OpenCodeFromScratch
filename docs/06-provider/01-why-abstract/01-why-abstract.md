# 6.1 为什么需要 Provider 抽象

> 本课目标：理解当前代码的问题，定义 Provider 接口，把硬编码的 OpenAI 调用重构成一个 Provider 实现。

## 当前代码的问题

我们的 `src/llm.ts` 里，`chatWithTools` 硬编码了 OpenAI 的 API 格式：

```ts
// 请求 URL 硬编码成 OpenAI 的 /chat/completions
const response = await fetch(`${config.baseURL}/chat/completions`, { ... })

// 请求体用 OpenAI 的格式
body: JSON.stringify({
  model: config.modelID,
  stream: true,
  messages,                    // OpenAI 的 messages 格式
  tools: tools.map(toolToOpenAIFormat),  // OpenAI 的 tools 格式
})

// 响应解析用 OpenAI 的格式
const delta = json.choices[0]?.delta     // OpenAI 的 choices[0].delta
const content = delta?.content            // OpenAI 的文本字段
if (delta?.tool_calls) { ... }           // OpenAI 的 tool_calls 格式
```

**每一段都绑死了 OpenAI 的 API 格式。** 如果要接 Anthropic（Claude），这些全要改——因为 Anthropic 的 API 格式完全不同。

## N×M×K 问题

不只是"两个 provider"的问题。考虑：

- **N 个 provider**：OpenAI、Anthropic、Google Gemini、AWS Bedrock...
- **M 种 API 协议**：Chat Completions、Messages API、GenerateContent、Converse...
- **K 种认证方式**：Bearer token、x-api-key header、AWS SigV4 签名...

如果每个 provider 写一套完整代码，就是 **N×M×K** 个组合。但很多 provider 共用同一种协议——DeepSeek、TogetherAI、Cerebras 都用 OpenAI Chat Completions 协议，只是 baseURL 不同。

如果能把"协议""端点""认证"拆开，各自独立组合，就只需要 **N+M+K**。这就是 opencode 的 Route 四轴模型要解决的问题（6.3 课详细讲）。

## 我们的简化方案：Provider 接口

我们不需要一步到位搞四轴模型。先用最简单的抽象——**Provider 接口**：

```ts
// src/provider.ts
import type { Message } from "./types"
import type { Tool } from "./tool/tool"

// Provider 接口：所有 provider 都要实现这个
// 对照 opencode: 它的 Route 接口更复杂（Protocol + Endpoint + Auth + Framing 四轴）
// 我们简化为一个方法：chatWithTools
export interface Provider {
  // provider 的唯一标识（如 "openai"、"anthropic"）
  id: string

  // 带 tool calling 的流式对话
  // 输入：messages 历史、tools 列表、onChunk 回调（流式输出文本）
  // 输出：完整文本 + tool calls
  chatWithTools(
    messages: Message[],
    tools: Tool[],
    onChunk: (text: string) => void,
  ): Promise<{ text: string; toolCalls: ToolCall[] }>
}
```

agent 代码（index.ts）只通过这个接口调用，不关心底下是 OpenAI 还是 Anthropic：

```ts
// 之前：直接调 chatWithTools 函数
const result = await chatWithTools(messages, config, tools, onChunk)

// 之后：通过 Provider 接口调用
const result = await provider.chatWithTools(messages, tools, onChunk)
```

> Python 类比：这就像 Python 的 `ABC`（抽象基类）。定义一个接口，不同 provider 是不同的实现类。`protocol` 或 `ABC` 都行，核心是"面向接口编程"。

## 重构：从 llm.ts 到 OpenAIProvider

我们把 `llm.ts` 里的 `chatWithTools` 逻辑搬到一个 Provider 实现里。

### 之前：llm.ts 里的函数

```
src/llm.ts
├── loadConfig()          → 读配置文件
├── chat()                → 非流式（阶段 1，已不用）
├── chatStream()          → 流式（阶段 2，已不用）
└── chatWithTools()       → 流式 + 工具调用（当前在用）
```

### 之后：provider 模块

```
src/
├── provider.ts           → Provider 接口定义
├── provider/openai.ts    → OpenAI Provider 实现（从 llm.ts 搬过来）
└── llm.ts                → 保留 loadConfig，删除 chat 函数
```

### OpenAI Provider 实现

`src/provider/openai.ts` 就是把 `llm.ts` 的 `chatWithTools` 包成一个实现 Provider 接口的对象：

```ts
// src/provider/openai.ts
export function createOpenAIProvider(config: { baseURL: string; apiKey: string; modelID: string }): Provider {
  return {
    id: "openai",

    async chatWithTools(messages, tools, onChunk) {
      // 这里就是 llm.ts 里 chatWithTools 的逻辑
      // fetch → 流式读取 → 解析 SSE → 累积 tool_calls → 返回
      const response = await fetch(`${config.baseURL}/chat/completions`, { ... })
      // ...（和之前一样）
    },
  }
}
```

> **设计决策**：为什么用函数返回对象（`createOpenAIProvider(config)`）而不是 class？
> - 不需要继承，对象就够了
> - 闭包捕获 config，不需要 this
> - opencode 也是类似的模式——用函数组合，不用 class 继承

## 配置文件支持多 provider

`opencode.json` 已经支持多 provider 了（从阶段 1 开始就是这个格式）：

```json
{
  "model": "volcengine-plan/deepseek-v4-flash",
  "provider": {
    "volcengine-plan": {
      "baseURL": "https://ark.cn-beijing.volces.com/api/coding/v3",
      "apiKey": "your-key",
      "models": { ... }
    }
  }
}
```

改 `model` 字段就能切换 provider。我们需要做的是：根据 provider 配置创建对应的 Provider 对象。

```ts
// 加载 provider：读配置 → 根据 provider 类型创建 Provider 对象
const config = await loadConfig()
const provider = createOpenAIProvider(config)
// 后续如果加 Anthropic：
// const provider = providerID === "anthropic"
//   ? createAnthropicProvider(config)
//   : createOpenAIProvider(config)
```

## 运行

```bash
bun run src/index.ts
```

重构后行为不变——还是用 volcengine 的 OpenAI 兼容 API 对话。区别是内部代码结构变了：通过 Provider 接口调用，不再直接调 `chatWithTools` 函数。

## 本课小结

1. **问题**：当前代码硬编码 OpenAI 格式，换 provider 要改很多地方
2. **N×M×K 问题**：provider × 协议 × 认证，不抽象就是组合爆炸
3. **Provider 接口**：最简单的抽象——一个 `chatWithTools` 方法，agent 代码面向接口编程
4. **重构**：llm.ts 的 chatWithTools → provider/openai.ts 的 OpenAIProvider
5. **opencode 的方向**：Route 四轴模型把抽象做得更彻底（6.3 课讲）

下一步：[6.2 Anthropic Messages API](../02-anthropic-format/) —— 不同的 API 协议长什么样。
