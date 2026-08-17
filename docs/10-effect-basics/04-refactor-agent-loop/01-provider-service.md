# 10.4 ProviderService：把 provider 包成 Service

> 第 1 个文件。10.3 学了 Service 三件套，这课把它用起来：把 provider 和 tools 都做成 Service，agent loop 从 Context 自取，不再传参。

## 痛点回顾

10.1 课盘过：`createOpenAIProvider(config)` 在 `index.ts` 和 `tui/agent.tsx` **各重复一份**。现在用 10.3 学的三件套把 provider 也变成 Service：

看 `src/service/provider.ts`。三件套和 ConfigService 结构一样：

```ts
// 1. 能力清单
export interface ProviderServiceApi {
  readonly chatWithTools: (
    messages: Message[],
    tools: Tool[],
    onChunk: (text: string) => void,
  ) => Promise<{ text: string; toolCalls: ToolCall[] }>
}

// 2. tag（照抄模板，换名字和 ID）
export class ProviderService extends Context.Service<ProviderService, ProviderServiceApi>()(
  "opencode-from-scratch/Provider",
) {}

// 3. 造实例的 Layer
export const providerLayer = Layer.effect(
  ProviderService,
  Effect.gen(function* () {
    const configService = yield* ConfigService
    const config = yield* configService.get()
    const provider = createOpenAIProvider(config)
    return ProviderService.of({
      chatWithTools: (messages, tools, onChunk) => provider.chatWithTools(messages, tools, onChunk),
    })
  }),
)
```

## 新东西：Layer 依赖 Layer

**providerLayer 的函数体里 `yield* ConfigService`。** 这就是 10.3 课末尾预告的"Layer 里也能取别的服务"——provider 需要 config 才能造出来，所以 providerLayer **需要** ConfigService。

注意这里两个 yield* 的层次不同：
- `yield* ConfigService`：从 Context 取 ConfigService 的**服务对象**（10.3 课的"第一步"）
- `yield* configService.get()`：调服务方法，拆返回值的盒子，拿到**真正的 Config**

`createOpenAIProvider(config)` 是纯函数，返回 Provider 对象。在 Layer 里调用它，**只执行一次**（provide 时），之后所有 `yield* ProviderService` 拿到的都是同一个实例。

## 返回类型没变

`chatWithTools` 仍然返回 `Promise<...>`，没有改成 Effect。这是刻意为之（10.4 只做依赖注入，Stream 化是后面的课）。非 Effect 代码在 Effect 世界里怎么用？用 10.2 学的 `Effect.promise` 桥接——下一课 agent loop 会看到。

## 对照 opencode

`opencode/packages/llm/src/route/client.ts` 的 LLMClient 就是同一个模式：

```ts
export class Service extends Context.Service<Service, Interface>()("@opencode/LLMClient") {}
export const layer: Layer.Layer<Service, never, RequestExecutor.Service> = Layer.effect(...)
```

- `@opencode/LLMClient` —— tag 的 ID，对应我们的 `"opencode-from-scratch/Provider"`
- `Layer.effect(...)` —— 造实例，对应我们的 `providerLayer`
- `Interface` 里声明 `prepare` / `stream` / `generate` 方法 —— 对应我们的 `chatWithTools`

结构完全一样。opencode 的 LLMClient 还依赖 `RequestExecutor.Service`（HTTP 请求执行器），就像我们的 providerLayer 依赖 ConfigService。

## 小结

1. **ProviderService 三件套**：ProviderServiceApi（能力）+ ProviderService（tag）+ providerLayer（造实例）
2. **Layer 依赖 Layer**：providerLayer `yield* ConfigService` 才能造出 provider
3. **返回类型不变**：chatWithTools 还是 Promise，用 `Effect.promise` 桥接

---

下一步：[ToolRegistry：把 tools 数组包成 Service](./02-tool-registry.md)
