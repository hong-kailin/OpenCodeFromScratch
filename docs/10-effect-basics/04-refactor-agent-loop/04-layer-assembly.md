# 10.4 入口组装 Layer：provide + mergeAll

> 第 4 个文件。前三节做好了 Service 和 agent loop，这节看最外层：怎么把各个 Layer 组装起来，run 整个程序。

## 问题：谁把依赖装进 Context？

agent loop 里 `yield* ProviderService`、`yield* ToolRegistry`，但服务实例从哪来？得有人先"挂上墙"。这步发生在**程序入口**——run 之前。

CLI 版入口在 `src/index.ts`，TUI 版在 `src/tui/agent.tsx`。两处组装方式一样，看 CLI 版：

```ts
// 组装所有 Layer
const appLayers = Layer.mergeAll(
  providerLayer.pipe(Layer.provide(configLayer)),  // 先喂 config 给 provider
  toolRegistryLayer,
)

async function runLoop(messages: Message[], callbacks: LoopCallbacks): Promise<void> {
  await Effect.runPromise(
    runAgentLoop(messages, callbacks).pipe(Effect.provide(appLayers)),
  )
}
```

## 关键坑：Layer 依赖不能靠 mergeAll 自动解析

最容易踩的坑在这行：

```ts
providerLayer.pipe(Layer.provide(configLayer))
```

**为什么不能直接 `Layer.mergeAll(configLayer, providerLayer, toolRegistryLayer)`？**

因为 `providerLayer` 的"需求"是 ConfigService（它函数体里 `yield* ConfigService`）。`Layer.mergeAll` 只把各 Layer 简单合并，**类型层面不会自动把"configLayer 提供的 ConfigService"喂给"providerLayer 需要的 ConfigService"**。如果直接 mergeAll 三个，TypeScript 会报错：

```
Argument of type 'Effect<void, Error, ConfigService>' is not assignable to
parameter of type 'Effect<void, Error, never>'.
```

意思是：`providerLayer` 还欠着 `ConfigService` 没还，TypeScript 不肯让你 run。

正确做法是**显式喂**：

```ts
providerLayer.pipe(Layer.provide(configLayer))
// 把 configLayer 提供的服务，喂给 providerLayer 的需求
// 结果：一个"不欠任何东西"的 providerLayer
```

然后才 mergeAll：

```ts
Layer.mergeAll(providerLayer.pipe(Layer.provide(configLayer)), toolRegistryLayer)
```

`toolRegistryLayer` 没有依赖（不 yield* 别的服务），所以直接合并。

对照 opencode：`opencode/packages/core/src/tool/registry.ts` 的末尾：

```ts
const layer = Layer.effect(Tools.Service, ...).pipe(Layer.provideMerge(registryLayer))
```

`Layer.provideMerge` = provide + merge 一步到位。opencode 用的是合体版本，我们拆开写（先 provide 再 mergeAll），更容易看懂每一步。

## 组装后发生了什么

`Effect.provide(appLayers)` 在 run 之前把组装好的 Layer 装进 Context：

```
runAgentLoop(messages, callbacks)
  │
  ▼
.pipe(Effect.provide(appLayers))     ← 把依赖装进 Context（还是延迟的，没执行）
  │
  ▼
Effect.runPromise(...)               ← 真正执行
  │
  ├─ appLayers 依次构建：
  │    ├─ configLayer 构建 ConfigService（读文件）
  │    ├─ providerLayer 构建 ProviderService（依赖已满足，直接造）
  │    └─ toolRegistryLayer 构建 ToolRegistry（返回工具数组）
  │
  └─ 执行 runAgentLoop 函数体
       ├─ yield* ProviderService   → 从 Context 取到
       ├─ yield* ToolRegistry      → 从 Context 取到
       └─ ... 循环 ...
```

## 之前 vs 现在（对照 10.1 痛点）

```
之前（10.1 痛点）：
  const config = await loadConfig()          // 读文件
  const provider = createOpenAIProvider(config)   // 造 provider
  const tools = [readTool, ...]              // 列工具
  runAgentLoop(messages, provider, tools, callbacks)  // 全传进去

现在（10.4）：
  runAgentLoop(messages, callbacks)
    .pipe(Effect.provide(appLayers))   // 依赖在入口一次性装配
```

注意现在的入口代码**不再 import 具体的 readTool/writeTool/...**——那些只在 `tool-registry.ts` 里出现一次。消费方不知道、也不关心有哪些工具。

## 本课小结

1. **入口负责组装**：run 之前 `Effect.provide(组装好的 Layer)`
2. **Layer 依赖要显式喂**：`providerLayer.pipe(Layer.provide(configLayer))`，不能靠 mergeAll 自动解析
3. **消费方零感知**：index.ts / agent.tsx 不再 import 具体工具，只 import 三个 Service 和组装函数

---

下一步：[10.4 验收 + 工程思维总结](./05-stage-review.md)
