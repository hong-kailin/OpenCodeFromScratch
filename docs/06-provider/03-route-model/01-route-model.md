# 6.3 对照 opencode Route 四轴模型 + 阶段验收

> 本课目标：理解 opencode 的 Route 四轴模型，对比我们的简化 Provider 接口，完成阶段 6 验收。

## 我们的 Provider 接口

我们用一个接口抽象了所有 provider：

```ts
interface Provider {
  id: string
  chatWithTools(messages, tools, onChunk): Promise<ChatResult>
}
```

OpenAI Provider 和 Anthropic Provider 各自实现这个接口，agent 代码只通过接口调用。

这够用，但不够**正交**——URL、认证、请求格式、流式解析全揉在 `chatWithTools` 一个函数里。改一个维度（比如换认证方式），要改整个函数。

## opencode 的 Route 四轴模型

opencode 把 provider 拆成四个**正交**的维度：

```
Route = Protocol + Endpoint + Auth + Framing
         ↑          ↑         ↑      ↑
         什么协议    哪里发    怎么认证  怎么切流
```

### 四轴各管什么

| 轴 | 管什么 | 不关心什么 | Python 类比 |
|---|--------|-----------|-------------|
| **Protocol** | API 协议格式（请求体 schema、响应事件解析） | URL、认证 | `requests.post()` 的 body 构造 |
| **Endpoint** | 请求发到哪（baseURL、path） | 协议格式、认证 | URL 拼接 |
| **Auth** | 怎么认证（Bearer、x-api-key、SigV4） | URL、协议 | headers 里的认证字段 |
| **Framing** | 字节流怎么切成帧（SSE、AWS event-stream） | 协议语义、认证 | 响应流的分帧方式 |

### 正交组合的威力

关键洞察：很多 provider 共用同一种协议，只是 URL 不同。

DeepSeek、TogetherAI、Cerebras、Groq 都用 OpenAI Chat Completions 协议。在 opencode 里，定义一个新 provider 只需 3 行：

```ts
// opencode/packages/llm/src/providers/openai-compatible-profile.ts
export const profiles = {
  deepseek: { provider: "deepseek", baseURL: "https://api.deepseek.com/v1" },
  cerebras: { provider: "cerebras", baseURL: "https://api.cerebras.ai/v1" },
  groq:     { provider: "groq",     baseURL: "https://api.groq.com/openai/v1" },
  // ... 更多
}
```

不用写 300 行代码，只写 3 行配置——因为 Protocol、Auth、Framing 都复用 OpenAI 的。

### N×M×K 变成 N+M+K

不拆分：N 个 provider × M 种协议 × K 种认证 = N×M×K 个组合
拆分后：N 个 Endpoint + M 个 Protocol + K 个 Auth = N+M+K 个组件，自由组合

```
不拆分（N×M×K）：
  OpenAI+Chat+Bearer    → 300 行
  DeepSeek+Chat+Bearer  → 300 行（几乎复制）
  Anthropic+Messages+ApiKey → 300 行
  Bedrock+Converse+SigV4 → 300 行
  总共：4 × 300 = 1200 行

拆分后（N+M+K）：
  Protocol: OpenAI Chat (500行)、Anthropic Messages (500行)、Bedrock Converse (500行)
  Endpoint: openai.com、deepseek.com、anthropic.com、bedrock...  （各 3 行）
  Auth: Bearer、x-api-key、SigV4  （各 20 行）
  Framing: SSE、AWS event-stream  （各 30 行）
  总共：3×500 + 4×3 + 3×20 + 2×30 = 1648 行，但能组合出 3×4×3×2=72 种 Route
```

> 行数没少多少，但**组合数**从 4 变成 72。加一个新 provider 可能只要 3 行（复用现有 Protocol + Auth + Framing）。

## 我们的接口 vs Route 四轴

| | 我们的 Provider | opencode 的 Route |
|---|----------------|-------------------|
| 维度数 | 1 个（chatWithTools） | 4 个（Protocol + Endpoint + Auth + Framing） |
| 复用粒度 | 整个 Provider | 每个维度独立复用 |
| 加 OpenAI 兼容 provider | 写一个新 Provider | 3 行配置（复用 Protocol） |
| 加新协议 | 写一个新 Provider | 写一个新 Protocol（复用 Auth/Framing） |
| 加新认证 | 改 Provider 代码 | 写一个新 Auth（不改 Protocol） |
| 复杂度 | 低 | 高（但可组合） |

### 什么时候该从简单接口演进到 Route 模型？

| 场景 | 简单接口够用 | 该用 Route |
|------|------------|-----------|
| 2-3 个 provider | ✓ | 不需要 |
| 10+ 个 provider，多数兼容 | 复制粘贴也能跑 | 3 行配置更省事 |
| 多种认证方式（Bearer、API key、签名） | 每个 Provider 自己写 | Auth 独立复用 |
| 多种传输方式（HTTP、WebSocket） | 每个 Provider 自己写 | Transport 独立复用 |
| 需要 Schema 校验请求/响应 | 手动检查 | Protocol 自带 Schema |

> **工程思维**：正交分解是"投入换扩展性"的 trade-off。前期拆分成本高（4 个接口比 1 个复杂），但加新 provider 时成本极低。provider 少时不必拆，多了再拆。

## 验收清单

```bash
# 1. 类型检查通过
bun run typecheck

# 2. OpenAI Provider 跑通
bun run src/index.ts
# 输入 "你好" → AI 回复

# 3. 调试模式
DEBUG_INPUTS='["你好"]' bun run src/index.ts
```

| 验收项 | 状态 |
|--------|------|
| Provider 接口定义（provider.ts） | ✓ |
| OpenAI Provider 实现（provider/openai.ts） | ✓ |
| Anthropic Provider 参考代码（provider/anthropic.ts） | ✓ |
| agent 代码通过接口调用（index.ts） | ✓ |
| 配置文件支持多 provider | ✓ |
| OpenAI Provider 跑通 | ✓ |
| typecheck 通过 | ✓ |

## 项目结构

阶段 6 新增/修改的代码：

```
src/
├── index.ts              # 修改：通过 Provider 接口调用
├── llm.ts                # 修改：精简为只保留 loadConfig
├── provider.ts           # 新增：Provider 接口 + ChatResult 类型
└── provider/
    ├── openai.ts         # 新增：OpenAI 兼容 Provider 实现
    └── anthropic.ts      # 新增：Anthropic Provider 参考代码（不运行）
```

## 工程思维总结

### 1. 面向接口编程

把 `chatWithTools` 函数调用改成 `provider.chatWithTools()` 方法调用，看似只是换了个写法。但本质是**依赖倒置**——之前 agent 代码依赖具体实现（llm.ts 的函数），现在依赖抽象接口（Provider）。

> Python 类比：从 `from llm import chat_with_tools` 变成 `def __init__(self, provider: Provider)`。agent 不关心 provider 是哪个，只关心它有 `chatWithTools` 方法。

### 2. 正交分解

opencode 的 Route 四轴是教科书级的正交分解案例。核心思想：**把变化的维度拆开，各自独立变化**。

- Protocol 变了（新 API 格式）→ 只改 Protocol，不动 Auth/Endpoint/Framing
- Auth 变了（换认证方式）→ 只改 Auth，不动 Protocol
- Endpoint 变了（换 baseURL）→ 只改 Endpoint

> **算法背景**：这和算法里的"分治"思想一样——把一个大问题拆成独立的小问题，分别解决。正交分解是分治在架构设计上的应用。

### 3. 简单到演进的路径

我们的 Provider 接口不是"错误的设计"，是"正确的简化"。它和 opencode 的 Route 遵循同样的思想（抽象 + 接口），只是拆分粒度更粗。

演进路径：
1. **现在**：1 个接口，2 个实现（OpenAI + Anthropic）
2. **provider 变多时**：拆出 Endpoint（baseURL 配置化）
3. **认证变多时**：拆出 Auth
4. **协议变多时**：拆出 Protocol（请求/响应格式转换）
5. **最终**：Route 四轴

每一步都是"痛了再拆"，不是"提前拆"。

## 阶段 6 学了什么

| 课 | 知识点 |
|----|--------|
| 6.1 | N×M×K 问题、Provider 接口设计、从函数重构到接口、面向接口编程 |
| 6.2 | OpenAI vs Anthropic API 差异（system、content block、tool_use、流式事件）、格式转换 |
| 6.3 | Route 四轴模型（Protocol + Endpoint + Auth + Framing）、正交组合 vs 简单接口的 trade-off |

你现在是"可切换 provider 的 agent"。下一步是让 agent 能读取项目指令——AGENTS.md 文件加载和 system prompt 组装。

---

下一步：[阶段 7：System Context & AGENTS.md](../../07-system-context/) —— 组装给 LLM 的系统指令。
