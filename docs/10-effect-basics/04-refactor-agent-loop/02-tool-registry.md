# 10.4 ToolRegistry：把 tools 数组包成 Service

> 第 2 个文件。上节把 provider 包成 Service，这节把 tools 数组也包成 Service，解决"加工具要改多处"的痛点。

## 痛点回顾

10.1 课盘过：工具数组 `[readTool, writeTool, editTool, bashTool, globTool, grepTool]` 在 `index.ts` 和 `tui/agent.tsx` **各重复一份**。加第 7 个工具要改两处。

用 Service 解决：工具在 Layer 里**注册一次**，谁需要谁从 Context 取。

看 `src/service/tool-registry.ts`：

```ts
export interface ToolRegistryApi {
  readonly list: () => Tool[]
}

export class ToolRegistry extends Context.Service<ToolRegistry, ToolRegistryApi>()(
  "opencode-from-scratch/ToolRegistry",
) {}

export const toolRegistryLayer = Layer.effect(
  ToolRegistry,
  Effect.sync(() =>
    ToolRegistry.of({
      list: () => [readTool, writeTool, editTool, bashTool, globTool, grepTool],
    }),
  ),
)
```

## 和 ConfigService/ProviderService 的差异

前两个 Service 都用 `Effect.gen`，这里用的是 `Effect.sync`：

| | Effect.gen | Effect.sync |
|---|---|---|
| 用于 | 异步 + 需要 yield* 多步 | 同步就能算出值 |
| 例子 | 读文件、调别的服务 | 直接返回一个数组 |

`Effect.sync` 是"同步的 Effect"：函数体立刻产生一个值，包进 Effect。造工具数组不需要异步（工具对象是静态定义的），所以用 sync 就够了。

## 为什么叫"注册表"（Registry）

"注册"的意思是：把工具集中登记在一个地方。opencode 里这个概念叫 **ToolRegistry**（`opencode/packages/core/src/tool/registry.ts`），我们是简化版。

我们简化了多少？对照 opencode 的注册表：

| opencode 的能力 | 我们简化成 |
|---|---|
| `register(tools)`：运行中动态注册 | 静态数组，定义时写死 |
| `materialize()`：生成 LLM 要的工具定义 | `list()` 直接返回 Tool 数组 |
| `settle(input)`：执行工具 | 没有（agent loop 里直接调 tool.execute） |
| `permission()`：权限过滤 | 没有（阶段 16 讲） |
| scoped：注册的生命周期管理 | 没有（一次注册，永远生效） |

## 验证：加第 7 个工具只改一处

现在加一个 `bash 外的工具`，比如 `truncate` 之外的 `find` 工具，只改 `tool-registry.ts` 的 `list()` 数组。`index.ts`、`tui/agent.tsx`、`agent-loop.ts` 全部不用动——因为它们都从 Context 取，不关心具体有哪些工具。

这就是 10.4 的核心收益：**依赖集中注册，消费方只声明"我需要工具"，不关心"有哪些工具"。**

## 小结

1. **ToolRegistry 三件套**：能力（list）+ tag + Layer（注册一次）
2. **Effect.sync vs Effect.gen**：同步能算出的值用 sync
3. **注册表模式**：加工具只改一处，消费方不关心具体清单

---

下一步：[重构 agent loop：合并两个 loop + Effect.fn](./03-agent-loop.md)
