# 11.3 Layer 依赖 + 型安全

> 对照代码：`src/service/provider.ts`、`src/service/tool-registry.ts`、`src/service/layer-deps-demo.ts`

## Layer 也可以消费别的 Service

ConfigService 是独立的——Layer 里只读文件。但如果一个 Service 的构造需要另一个 Service 呢？

**ProviderService 需要 ConfigService**：要造 provider，先得拿到 baseURL/apiKey。

```typescript
// src/service/provider.ts
export const providerLayer = Layer.effect(
  ProviderService,
  Effect.gen(function* () {
    const configService = yield* ConfigService  // ← Layer 里取别的 Service
    const config = yield* configService.get()
    const provider = createOpenAIProvider(config)
    return ProviderService.of({
      chatWithTools: (messages, tools, onChunk) =>
        provider.chatWithTools(messages, tools, onChunk),
    })
  }),
)
```

`yield* ConfigService` 在 Layer 的构造函数里和普通 Effect.gen 里用法完全一样——都是从 Context 取。

## 三个 Service 的依赖关系

```
configLayer               toolRegistryLayer
(读文件造 Config)          (返回固定工具数组)
      │
      │ 被依赖
      ▼
providerLayer
(需要 Config 才能造 provider)
```

```
没有依赖的 Service：
  configLayer       → 独立，读文件即可
  toolRegistryLayer → 独立，返回固定数组

有依赖的 Service：
  providerLayer     → 需要 ConfigService
```

## 关键坑：mergeAll 不会自动解析依赖

假设三个 Layer 都写好了，现在要组装：

```typescript
// ❌ 错误写法——typecheck 会报错
const appLayers = Layer.mergeAll(configLayer, providerLayer, toolRegistryLayer)
```

**为什么会报错？** 因为 providerLayer 的"需求"还没被满足。

TypeScript 的类型系统会追踪每个 Layer 的"欠债"：

```
configLayer       : Layer<ConfigService,  never, never>
                      ↑ 提供什么         ↑ 需要什么（无）
toolRegistryLayer : Layer<ToolRegistry,  never, never>
providerLayer     : Layer<ProviderService, never, ConfigService>
                                               ↑ 还欠着 ConfigService！
```

`mergeAll` 只是简单合并，不会自动把 configLayer 提供的 ConfigService 喂给 providerLayer。所以 TypeScript 报错：providerLayer 的第三个类型参数不是 `never`（还欠着债）。

**正确做法：先喂依赖，再合并**

```typescript
// ✅ 第一步：把 configLayer 喂给 providerLayer
const satisfiedProvider = providerLayer.pipe(Layer.provide(configLayer))
// satisfiedProvider 类型：Layer<ProviderService, never, never>
// 三个 never = 不欠任何东西了

// ✅ 第二步：合并
const appLayers = Layer.mergeAll(configLayer, satisfiedProvider, toolRegistryLayer)
```

图解：

```
组装前：
  providerLayer 还欠着 ConfigService
         │
         │ Layer.provide(configLayer)  ← 喂给它
         ▼
  satisfiedProvider 不欠任何东西了
         │
         ├── Layer.mergeAll ── configLayer
         └── Layer.mergeAll ── toolRegistryLayer
         │
         ▼
  appLayers（三个 Layer 合并，依赖全部满足）
```

## ToolRegistry：无依赖的 Service（对比）

```typescript
export const toolRegistryLayer = Layer.effect(
  ToolRegistry,
  Effect.sync(() =>  // 不需要 gen/yield*，因为没有异步操作，也不取别的服务
    ToolRegistry.of({
      list: () => [readTool, writeTool, editTool, bashTool, globTool, grepTool],
    }),
  ),
)
```

`Effect.sync` = 同步的 Effect：函数体立刻产生一个值，包进 Effect。适合不需要异步、不需要取其他服务的简单场景。

## 对照 opencode

opencode 的 `llm/src/route/client.ts` 末尾用 `Layer.provideMerge`：

```typescript
const layer = Layer.effect(LLMClient.Service, ...)
  .pipe(Layer.provideMerge(registryLayer))
```

`Layer.provideMerge` = provide + merge 一步到位。我们拆开写（先 provide 再 mergeAll），更容易看懂每一步。

## 跑一下

```bash
bun run src/service/layer-deps-demo.ts
```

验证三个 Service 正确组装，providerLayer 通过 configLayer 拿到了配置。