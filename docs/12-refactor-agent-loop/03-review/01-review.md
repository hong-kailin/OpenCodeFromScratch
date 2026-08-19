# 12.3 阶段验收

## 一图总结：重构前后对比

```
┌─ 重构前（阶段 9）─────────────────────────────────────────┐
│                                                          │
│  index.ts                     tui/agent.tsx              │
│  ┌──────────────────┐        ┌──────────────────┐       │
│  │ loadConfig()      │        │ loadConfig()      │       │
│  │ createProvider()  │        │ createProvider()  │       │
│  │ [readTool, ...]   │        │ [readTool, ...]   │       │
│  │ runToolLoop(...)  │        │ runAgentLoop(...) │       │
│  └──────────────────┘        └──────────────────┘       │
│  各自维护一份依赖            两个 loop 逻辑重复             │
└──────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─ 重构后（阶段 12）─────────────────────────────────────────┐
│                                                          │
│  index.ts                     tui/agent.tsx              │
│  ┌──────────────────┐        ┌──────────────────┐       │
│  │ 组装 Layer       │        │ 组装 Layer        │       │
│  │ runAgentLoop()   │        │ runAgentLoop()    │       │
│  │  + onMessage     │        │  （无 onMessage）  │       │
│  └──────┬───────────┘        └──────┬───────────┘       │
│         │                           │                    │
│         └───────────┬───────────────┘                    │
│                     ▼                                    │
│         ┌──────────────────────┐                        │
│         │    runAgentLoop      │  唯一的 loop            │
│         │  yield* Provider     │  provider/tools 从      │
│         │  yield* ToolRegistry │  Context 自取           │
│         └──────────────────────┘                        │
│                     │                                    │
│         ┌───────────┴───────────┐                        │
│         ▼                       ▼                        │
│    ProviderService         ToolRegistry                  │
│    (依赖 ConfigService)    (无依赖)                       │
└──────────────────────────────────────────────────────────┘
```

## 验收清单

- [ ] 能解释 `Effect.fn("Name")` 的作用——给函数加 trace 名
- [ ] 能解释 `Effect.promise` 在 loop 里的桥接作用——把 Promise 转成 Effect
- [ ] 理解 `onMessage` 回调如何承载 CLI/TUI 的持久化差异
- [ ] 理解签名瘦身的意义——加新依赖不改签名

## 验证方式

```bash
# demo：重构前后对比
bun run src/agent-loop-demo.ts

# CLI：跑通
bun run src/index.ts run "用 read 工具读 src/agent-loop.ts"

# TUI：跑通
bun run src/tui/agent.tsx
```

## 工程思维

**1. 用回调承载差异，而非复制代码**

CLI 和 TUI 的 loop 核心逻辑完全一样。唯一区别是持久化——CLI 存 DB，TUI 不存。与其写两个 loop，不如在 loop 里留一个钩子（`onMessage`），让调用方注入自己的逻辑。

**2. 依赖注入让函数签名稳定**

`runAgentLoop(messages, callbacks)` 这个签名以后不会再变。加新依赖（比如数据库访问、权限检查）时，函数体里加一行 `yield*` 就行，所有调用方不受影响。

**3. 渐进式重构**

`chatWithTools` 和 `tool.execute` 还是返回 Promise，用 `Effect.promise` 桥接。这意味着不需要一次性重写所有代码——核心（loop）先享受 DI 的好处，边界（provider）逐步迁移。

## 阶段产出

```
src/
├── agent-loop.ts          # 重构：Effect.fn + Context 取依赖 + onMessage
├── index.ts               # 重构：删 runToolLoop，入口组装 Layer
├── tui/agent.tsx          # 重构：从 Context 取依赖
├── agent-loop-demo.ts     # 演示：重构前后对比
```

## 下一步

阶段 13：Effect Schema + Typed Errors——用 Schema 做运行时校验，替换裸 JSON.parse。