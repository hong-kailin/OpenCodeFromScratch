# 17.0（上）当前 Provider 到底出了什么问题

这一阶段来自一个具体需求：火山 Coding Plan 到期后，希望改用 Codex，并复用 ChatGPT 订阅额度。

先不要写 Codex 代码。我们要先回答：**当前代码为什么无法自然地完成这次切换？**

配套阅读：

- [当前 OpenAI Provider](../../../packages/core/src/provider/openai.ts)
- [Anthropic 参考 Provider](../../../packages/core/src/provider/anthropic.ts)
- [Provider 公共接口](../../../packages/core/src/provider/interface.ts)

## `Provider` 接口解决过什么问题

阶段 6 引入 `Provider` 后，Agent loop 只依赖 `chatWithTools`。上层不再关心底层使用
OpenAI 还是 Anthropic，这是正确的 dependency inversion。

```text
Agent loop ──> Provider.chatWithTools(...)
                    │
                    └── 具体 HTTP 调用
```

问题不在这个接口。问题在接口下面：一次 HTTP 调用的所有变化都被塞进了一整个 Provider 文件。

### “接口下面”到底指哪里

这里的“下面”说的是**调用关系**，不是文件夹层级。Agent loop 调用 `Provider` 接口后，真正发出 HTTP 请求的实现细节，都藏在 `chatWithTools` 后面：

```text
Agent loop
    │
    ▼
Provider.chatWithTools(...)       ← 面向调用者的稳定边界
    │
    ▼
createOpenAIProvider              ← 接口后面的具体实现
    ├── 拼接 URL
    ├── 添加认证 header
    ├── 把通用消息转换成请求体
    └── 把响应字节转换成通用事件
```

`Provider` 接口已经解决了一个重要问题：**Agent loop 可以替换整个 Provider，而不需要跟着修改。** 例如把 `createOpenAIProvider` 换成 `createAnthropicProvider`，上层仍然只调用 `chatWithTools`。

但是，“可以替换整个实现”和“可以复用实现内部的零件”是两种不同的扩展能力：

| 想做的变化 | 当前是否容易做到 | 原因 |
|---|---|---|
| OpenAI 整体换成 Anthropic | 是 | 两者都实现了 `Provider` 接口 |
| 只把 API key 认证换成 OAuth | 否 | 认证逻辑没有独立入口，只是 `chatWithTools` 内部的几行代码 |
| 两个 Provider 共用同一套 SSE 解析 | 否 | SSE 解析也写在各自的 `chatWithTools` 里面 |
| 保留认证方式，只更换请求和响应格式 | 否 | 数据格式转换和其余 HTTP 逻辑绑在同一个函数里 |

以接入 Codex 为例。假设它与当前实现相比，只有认证从 API key 变成了 OAuth。当前代码没有一个可以传入或替换的 `Auth` 部件，因此我们不能只写“Codex 如何认证”。为了改这一个差异，仍然要新建或复制一整套 `chatWithTools`，连 URL 拼接、请求体转换和 SSE 解析也一起带走。

如果用 Python 类比，当前的 `Provider` 很像下面这个抽象基类：

```python
class Provider(Protocol):
    async def chat_with_tools(self, request): ...
```

它让调用者可以替换整个对象；但如果每个 `chat_with_tools()` 内部都自己拼 URL、加 header、序列化请求并解析流，那么不同实现仍然无法复用这些步骤。也就是说，**这个接口解决了 Agent loop 对具体 Provider 的耦合，却没有解决各个 Provider 实现之间的重复和耦合。**

所以接下来的目标不是删除 `Provider` 接口，而是保留这层稳定边界，再把它内部容易独立变化的部分拆出更小的组合点。这些部分就是后面要讲的 Route 四轴。

## 沿着一次请求找出四类变化

打开 `openai.ts`，一次请求从这里开始：

```ts
      const response = await fetch(`${config.baseURL}/chat/completions`, {
```

这一个函数同时决定了四件事：

| 当前代码 | 它决定了什么 |
|---|---|
| `` `${config.baseURL}/chat/completions` `` | 请求发到哪个 URL |
| `Authorization: Bearer ...` | 用什么方式证明身份 |
| `model / messages / tools` 与 `choices[0].delta` | 双方交换的数据语义 |
| 字节解码、按行切分、过滤 `data:` | 网络字节如何成为一条条事件 |

只接一个 OpenAI-compatible 服务时，把它们放在一起很直接。现在比较三种渠道：

| 渠道 | 会变化的部分 |
|---|---|
| 火山 Coding Plan | URL 和 API key 不同，仍兼容 Chat Completions + SSE |
| Anthropic | URL、认证 header、请求体、响应事件都不同，仍使用 SSE |
| Codex 订阅 | Codex URL、ChatGPT OAuth、Responses 请求与事件，仍使用 SSE |

变化不是按“厂商”整齐发生的。两个渠道可能共享协议，却使用不同 URL；也可能共享 SSE，
却使用完全不同的请求体和事件结构。

## 粗粒度 Provider 为什么导致复制

`anthropic.ts` 为了更换协议，不得不重新实现完整流程：拼 URL、加 header、发送请求、读取字节、
切 SSE、解析事件、累积工具调用。即使其中一部分与 `openai.ts` 相同，也没有可以直接复用的边界。

结果是：

```text
新增一种接入方式
      │
      ▼
复制一个 Provider 文件
      │
      ├── 修改真正不同的部分
      └── 顺便复制本来相同的部分
```

复制不仅增加代码量，还会复制 bug。当前 SSE 管线对每个网络 chunk 直接执行：

```ts
        Stream.flatMap((text) => Stream.fromIterable(text.split("\n"))),
```

网络 chunk 不保证和 SSE 行边界对齐。一行 JSON 可能在两个 chunk 之间断开；当前代码会把两个半行
分别交给后续解析。这是“如何切流”的 bug，但修复只能写进整个 OpenAI Provider，Anthropic 仍可能保留同类问题。

## 真正要改进的是什么

目标不是增加一个更大的 `if (providerID === ...)`，也不是马上复制一份 Codex Provider。

我们希望做到：

1. 更换 URL 时，不改请求体转换和流解析；
2. 更换认证方式时，不改 URL 和协议；
3. 所有 SSE 渠道共享同一份跨 chunk 分帧逻辑；
4. Chat Completions、Responses、Anthropic Messages 各自只处理自己的数据语义；
5. 最后把这些部件组合成一条可执行的调用路线。

所以阶段 17 要重构的对象不是“provider 名称”，而是 **Provider 内部的一次 LLM 调用流水线**。

下一份文档会给这四类职责正式命名，并说明它们怎样组成 Route。
