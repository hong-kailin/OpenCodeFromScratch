# 10.4 阶段验收：agent loop 服务化 + 工程思维

> 第 5 个文件。收尾：验证 10.4 目标达成，总结这课背后的工程思维。

## 验收清单

**1. typecheck 通过**

```bash
bun run typecheck
```

**2. CLI 跑通（带工具调用）**

```bash
bun run src/index.ts run "用 read 工具读取 src/service/config.ts"
```

能看到 `[调用工具] read(...)` 输出，说明 ProviderService、ToolRegistry、agent loop 全部从 Context 取到依赖并正常工作。

**3. 持久化正常（onMessage 钩子）**

跑完后消息存进了数据库（原来 CLI 版 runToolLoop 里手动 saveMessage 的逻辑，现在通过 `onMessage` 回调注入，效果一致）。

**4. TUI 跑通**

```bash
bun run src/tui/agent.tsx
```

能正常启动渲染界面。TUI 版不传 `onMessage`（可选回调），所以不持久化——和重构前行为一致。

**5. 加第 7 个工具只改一处**

在 `src/service/tool-registry.ts` 的 `list()` 数组里加一个工具。`index.ts`、`tui/agent.tsx`、`agent-loop.ts` 都不用动。这就是"注册一次，到处可取"。

## 对照 opencode：我们做到了什么程度

| | 我们（10.4） | opencode |
|---|---|---|
| Provider Service | `ProviderService`，一个 `chatWithTools` 方法 | `LLMClient.Service`，`prepare`/`stream`/`generate` 三个方法（`llm/src/route/client.ts`） |
| Tool 注册表 | `ToolRegistry`，`list()` 返回数组 | `ToolRegistry.Service`，`register`/`materialize`/`settle`（`core/src/tool/registry.ts`） |
| Loop | `runAgentLoop`，一个 while 循环 | `session/prompt.ts` 的 runLoop（还处理事件、断点、并行等） |
| 组装 | `Layer.mergeAll + Layer.provide` | 同样模式，还有 `Layer.provideMerge` 合体版 |
| Effect.fn | `Effect.fn("runAgentLoop")` | 每个重要函数都 `Effect.fn("LLM.compile")` 等 |

结构骨架已经和 opencode 对齐了。差异在**复杂度和能力**：
- opencode 的 LLMClient 支持流式（Stream）、结构化输出、多 provider 路由
- opencode 的 ToolRegistry 支持动态注册、权限、作用域生命周期
- opencode 的 runLoop 支持事件溯源、断点恢复、并行工具

这些是阶段 10 之后逐步补全的目标（Stream 是 10.5+，权限是 16，注册表完善是 18-19）。

## 工程思维总结

**1. 依赖注入解决的是"传递成本"问题**

10.1 课让你感受到痛：参数越传越多、两处重复、加工具要改多处。10.3-10.4 用 Service/Layer 解决了。核心转变：

```
"我需要什么，调用方给我"（传参）
      ↓
"我需要什么，我自己取"（Context 自取）
```

后者的好处不只是少写几个参数——**新依赖加入时，消费方签名不变，调用方也不用改**。这是架构能否持续演进的开关。

**2. 消费方只关心"能做什么"，不关心"具体是谁"**

`runAgentLoop` 说"我需要 ProviderService 和 ToolRegistry"，它不关心 provider 是 OpenAI 还是 Anthropic、工具有几个。换成别的实现（比如测试时换 mock），消费方零改动——只要 `Layer.provide` 喂进去的实例满足能力接口即可。这就是 10.3 课说的"可替换"。

**3. "注册表"模式：集中管理，分散使用**

工具清单只出现在 `tool-registry.ts` 一处。这是"单点修改"原则的体现——同类东西只在一个地方登记。opencode 整个架构都建立在这个模式上（tool registry、provider registry、agent registry...）。

**4. 大重构的姿势：先小步验证，再大改**

这次重构的节奏值得留意：
- 先做两个 Service（ProviderService、ToolRegistry），不碰 loop → typecheck 过
- 再改 agent loop（合并两个 loop、Effect.fn）→ typecheck 过
- 最后改入口（index.ts、agent.tsx）→ typecheck 过 + 实际跑通

每步都有可验证的中间状态，而不是一口气改完再找 bug。这比"憋大招"更安全。

## 10.4 产出文件一览

```
src/
├── service/
│   ├── config.ts         # 10.3 已有
│   ├── provider.ts       # 新增：ProviderService
│   └── tool-registry.ts  # 新增：ToolRegistry
├── agent-loop.ts         # 重构：合并两个 loop + Effect.fn + 从 Context 取
├── index.ts              # 重构：删 runToolLoop，入口组装 Layer
└── tui/agent.tsx         # 重构：从 Context 取依赖
```

---

下一步：[10.5 Effect Schema：运行时校验](./../05-schema/index.md)
