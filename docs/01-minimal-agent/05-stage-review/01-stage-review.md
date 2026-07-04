# 1.5 阶段验收：能对话的 agent + 工程思维总结

> 本课目标：验收阶段 1 的成果，总结工程思维，对照 opencode 看差距。

## 验收清单

跑一遍这些命令，全部通过说明阶段 1 完成：

```bash
# 1. 类型检查通过
bun run typecheck

# 2. 多轮对话能跑
bun run src/index.ts
# 输入 "1+1=?" → AI 回复 "2"
# 输入 "再加3"  → AI 回复 "5"（记得上下文）

# 3. 调试模式能跑
# VSCode 选 "调试（预设输入）" → F5 → 断点能触发
```

| 验收项 | 状态 |
|--------|------|
| 配置文件读取（opencode.json） | ✓ |
| HTTP 请求理解（URL/Method/Headers/Body） | ✓ |
| messages 结构（system/user/assistant） | ✓ |
| async/await 异步编程 | ✓ |
| fetch 调 LLM API | ✓ |
| 多轮对话（messages 历史维护） | ✓ |
| 调试模式（DEBUG_INPUTS 预设输入） | ✓ |

## 项目结构

阶段 1 结束后，新增的代码：

```
src/
├── index.ts          # 入口：多轮对话循环（prompt + while + messages.push）
├── llm.ts            # LLM 客户端：loadConfig + chat（fetch 调 API）
├── types.ts          # 类型定义：Message、ProviderConfig、Config
├── async-demo.ts     # async/await 教学演示
└── ...               # 阶段 0 的教学代码
opencode.json         # provider 配置（baseURL/apiKey/model）
```

## 对照 opencode：我们的 vs 真实版

我们的 `src/llm.ts` 的 `chat()` 函数：

```ts
// 简化版：一个函数搞定
async function chat(messages, config) {
  const response = await fetch(`${config.baseURL}/chat/completions`, { ... })
  const data = await response.json()
  return data.choices[0].message.content
}
```

opencode 的 LLM 调用（`packages/opencode/src/session/llm.ts`）：

```ts
// 真实版：多层抽象
const run = Effect.fn("LLM.run")(function* (input) {
  // 1. 获取语言、配置、provider、auth 等 8 个 service
  const language = yield* Language.Service
  const cfg = yield* Config.Service
  const provider = yield* Provider.Service
  // ... 还有 auth、permission、plugin、llmClient 等

  // 2. 准备请求（把 session 输入转成 LLM 请求）
  const prepared = yield* LLMRequestPrep.prepare(...)

  // 3. 选择 runtime：native（@opencode-ai/llm）还是 AI SDK
  if (flags.experimentalNativeLlm) {
    return yield* LLMNativeRuntime.stream(prepared)
  }
  // 4. AI SDK 路径：streamText + 转换成 LLMEvent
  return yield* LLMAISDK.toLLMEvents(...)
})
```

差距和原因：

| | 我们的 | opencode 的 | 为什么 opencode 更复杂 |
|---|--------|-------------|----------------------|
| 调用方式 | 裸 fetch | 两条路径（native + AI SDK） | 支持十几个 provider，每个有不同的 API 格式 |
| 配置读取 | `Bun.file().json()` | 多层合并（全局 + 项目级 + 远程 + 环境变量） | 支持团队配置、远程配置、MDM 托管 |
| 错误处理 | `throw new Error()` | Effect 的 typed error | 不同的错误类型走不同的恢复策略 |
| 依赖管理 | 无 | 8 个 service 注入 | auth、permission、plugin、telemetry 等关切分离 |
| 流式 | 无（等全部生成完） | Effect Stream | 逐字输出，用户不用等 |

**我们不急着补这些**——后续阶段会逐步引入。现在先理解"每一层抽象解决什么问题"：

### 为什么先裸 fetch

裸 fetch 让你看到了 LLM 调用的本质——就是一个 HTTP 请求。没有黑魔法。SDK 和抽象层只是在上面包了一层：

```
裸 fetch（我们现在的）
    ↓ 封装
LLM 客户端函数 chat()（我们现在的 llm.ts）
    ↓ 抽象
Provider 接口（阶段 6，支持多 provider）
    ↓ 再抽象
Route 四轴模型（阶段 6，opencode 的做法）
```

每一层抽象都有明确的动机：
- **chat() 函数**：避免每次调 API 都重复写 fetch + headers + JSON.parse
- **Provider 接口**：换 provider 不改代码（OpenAI → Anthropic → 火山引擎）
- **Route 模型**：DeepSeek、TogetherAI 等都兼容 OpenAI 格式，共用一个 protocol

> 工程思维：**先理解本质，再引入抽象**。如果一上来就用 SDK，你不知道 SDK 在做什么；先裸 fetch 跑通，再抽象时每一步都有明确的动机。

## 工程思维总结

### 1. 配置与代码分离

我们把 baseURL/apiKey/model 放在 `opencode.json` 里，不在代码里硬编码。换 provider 只改配置文件，不改代码。

> 这是 opencode 的核心设计决策之一——它的配置系统支持全局、项目级、远程等多层次，但本质都是"把会变的东西从代码里抽出来"。

### 2. LLM 没有记忆

这是 agent 开发最重要的概念。LLM 每次请求都是独立的，"记住"对话靠的是你每次把完整 messages 历史传过去。我们的 `while(true)` 循环就是在维护这个历史。

> opencode 的整个 session 系统（`session/message.ts`、`session/prompt.ts`）本质上就是在管理消息历史——持久化到数据库、压缩长对话、选择哪些消息传给 LLM。

### 3. 先跑通再完善

阶段 1 的 agent 很简陋——没有流式、没有工具、没有持久化。但它验证了核心链路：读配置 → 调 API → 维护历史。后续阶段往这个骨架上加功能，基础是可靠的。

> 工程思维：**先建立可工作的最小闭环，再逐步加功能**。

## 阶段 1 学了什么

| 课 | 知识点 |
|----|--------|
| 1.1 | 配置文件模式（opencode.json、provider/model 格式） |
| 1.2 | HTTP 请求基础、messages 结构、curl 实操 |
| 1.3 | async/await、Promise、fetch、JSON 序列化、读配置文件 |
| 1.4 | 多轮对话循环、prompt()、messages.push、agent loop 雏形 |

你现在是"能和 AI 多轮对话"的状态。下一步要让它更接近真正的 agent——能读文件、执行命令、搜索代码。

---

下一步：[阶段 2：流式输出](../../02-streaming/) —— AI 回复逐字打印到终端，不用等全部生成完。
