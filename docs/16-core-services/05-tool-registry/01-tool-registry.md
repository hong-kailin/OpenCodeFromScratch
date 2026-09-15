# 16.5 ToolRegistry 去中心化注册：没有中央工具列表

> 阶段 16 的地图见 [16.0 总览](../00-overview/01-overview.md)。
> 本课把"集中数组硬编码"改成 opencode 的去中心化注册模式——
> 每个工具自己注册自己，注册表空启动。

## 这一步做什么

ToolRegistry 从"内置 6 个工具"改成"空注册表 + register/list/get 三个能力"。
每个工具在自己的文件里加一个自注册 Layer，启动时 register 自己。

对照代码：`packages/core/src/tool/registry.ts` + 6 个工具文件末尾、
入口 `index.ts` / `tui/agent.tsx` 的 toolsLayer

## 之前的问题：集中数组硬编码

16.4 之前，registry 是这么写的：

```typescript
// registry.ts —— 集中列表
import { readTool } from "./read"
import { writeTool } from "./write"
// ... 每个工具都要 import

export const toolRegistryLayer = Layer.effect(
  ToolRegistry,
  Effect.sync(() =>
    ToolRegistry.of({
      list: () => [readTool, writeTool, editTool, bashTool, globTool, grepTool],
    }),
  ),
)
```

加第 7 个工具，要改 registry 的 **import + 数组**两处。而且 registry 依赖了
所有工具的细节——"注册表"变成了"工具大全"，职责混乱。

## opencode 的模式：去中心化注册

对照 opencode 的真实设计，它**没有"列出所有工具的数组"**：

- 每个工具在自己的文件里有一个 Layer，启动时 **register 自己**
- 注册表只提供 register / list / get 三个能力
- 工具列表由"组装各工具的 Layer"产生（入口的 toolsLayer）

这样加新工具只动**一处**：把新工具的 Layer 加进入口的 mergeAll。
registry 一行不用改——它根本不知道有哪些工具。

## registry 改造：空注册表

```typescript
// packages/core/src/tool/registry.ts
export interface ToolRegistryApi {
  readonly register: (tool: Tool<any, any>) => void   // 注册一个工具
  readonly list: () => Tool<any, any>[]               // 列出所有（发给 LLM）
  readonly get: (id: string) => Tool<any, any> | undefined  // 按 id 查（执行时）
}

export const toolRegistryLayer = Layer.effect(
  ToolRegistry,
  Effect.sync(() => {
    const tools = new Map<string, Tool<any, any>>()
    return ToolRegistry.of({
      register: (tool) => { tools.set(tool.id, tool) },
      list: () => Array.from(tools.values()),
      get: (id) => tools.get(id),
    })
  }),
)
```

**关键变化**：不再 `import` 任何工具，只提供一个空 Map。
"谁注册谁、注册哪些"由组装方决定——注册表保持纯粹。

## 各工具加自注册 Layer

每个工具文件末尾加一个 Layer，启动时把自己注册进去（以 read 为例）：

```typescript
// packages/core/src/tool/read.ts 末尾
export const readToolLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    // 从 Context 取注册表，把自己注册进去
    const registry = yield* ToolRegistry
    registry.register(readTool)
  }),
)
```

**`Layer.effectDiscard`** 是这里的新 API——"效果执行完不留值"。
注册是副作用（往 Map 里塞东西），没有返回值，所以用 discard 版本。
对比 `Layer.effect`（留值）和 `Layer.effectDiscard`（不留值）：
注册这种"做了就行"的事，用后者更贴切。

## 入口组装：toolsLayer（Layer 依赖 Layer）

工具 Layer 需要 ToolRegistry（register 要 yield* 它），这是**Layer 依赖 Layer**：

```typescript
// index.ts / tui/agent.tsx
const toolsLayer = Layer.mergeAll(
  readToolLayer,
  writeToolLayer,
  editToolLayer,
  bashToolLayer,
  globToolLayer,
  grepToolLayer,
).pipe(Layer.provide(toolRegistryLayer))   // 显式提供依赖！

const appLayers = Layer.mergeAll(
  configLayer,
  satisfiedProvider,
  toolRegistryLayer,   // agent-loop 也要 yield* ToolRegistry
  fileSystemLayer,
  toolsLayer,
)
```

> **为什么 mergeAll 之后还要显式 `.pipe(Layer.provide(toolRegistryLayer))`？**
> 回顾 11.3 课：`Layer.mergeAll` 只把多个 Layer **并排放**进一个 Layer，
> **不会自动解析 Layer 之间的依赖**。工具 Layer 需要 ToolRegistry，
> 必须手动 `Layer.provide` 把注册表喂进去。这是 11.3 的"Layer 依赖 Layer"。
> 对照 opencode：它用 `Layer.provideMerge`，效果一样。

## agent-loop 用 get 替代 find

注册表有了 `get(id)`（内部是 Map 查找，O(1)），agent-loop 不再 find 遍历：

```typescript
// 之前：const tool = toolList.find((t) => t.id === tc.function.name)
// 现在：
const tool = tools.get(tc.function.name)
```

## 教 debug

**场景**：启动报错，工具 Layer 里 `yield* ToolRegistry` 拿不到注册表。

排查：toolsLayer 的 `Layer.provide(toolRegistryLayer)` 漏了——mergeAll 不自动
解析依赖，必须显式 provide。检查工具 Layer 的依赖是否都被提供。

**场景**：发 tools 给 LLM 时工具列表为空。

排查：注册表空启动（没有内置工具），如果入口忘了 merge 任何工具 Layer
或忘了把 toolsLayer 加进 appLayers，注册表就是空的。检查这两处。

## 验证：这一步成功标志

```bash
bunx tsc --noEmit
bun run packages/opencode/src/index.ts run "用read工具读一下 packages/opencode/src/index.ts"
# 期望：read 工具正常调用——说明自注册 Layer 生效，注册表里能找到 read
```

## 这一步解决了什么

| 问题 | 解决了吗 | 说明 |
|------|---------|------|
| 加工具要改 registry 两处 | ✅ | 现在只改入口的 mergeAll 一处 |
| registry 依赖所有工具细节 | ✅ | 注册表空启动，不 import 任何工具 |
| 工具职责与注册机制分离 | ✅ | 工具只关心自己，注册由组装方决定 |

## 对照 opencode

| 我们 | opencode |
|------|----------|
| 每个工具文件末尾一个自注册 Layer | 每个工具文件一个 Layer（注册/权限） |
| `register/list/get` 三个能力 | `materialize/register` + 更复杂的 settle（权限、输出存储） |
| `Layer.effectDiscard` 注册 | 同思路，opencode 在 layer-node 组装 |

opencode 的注册表还负责 `materialize`（把工具定义转成发给 LLM 的格式）和
`settle`（带权限的调度），我们只留最核心的注册与查找——权限在阶段 20。

## 小结

第 5 步做完：
- 注册表空启动，工具各自注册（opencode 模式）
- 加第 7 个工具只改入口一处
- agent-loop 用 get 精确查找

## 下一步

[16.6 SessionStore 服务](../06-session-store/01-session-store.md)
——把 session + message 合并成一个服务，同时移除 16.2 的过渡桥接。
