# 11.1 Service 是什么：声明能力

> 对照代码：`src/service/config.ts`、`src/service-demo.ts`

## 先看全景：Service 解决什么问题

阶段 10.1 的痛点：`loadConfig()` 在 `index.ts` 和 `tui/agent.tsx` 各调一次。

```
现在（痛点）：
  index.ts ──loadConfig()──→ opencode.json  ←──loadConfig()── tui/agent.tsx
  每次启动读两次文件，两个入口各自维护一份

目标（DI，Dependency Injection 依赖注入）：
                   ┌──────────────┐
                   │ configLayer  │  ← 只在这里造一次
                   │ (读文件+缓存) │
                   └──────┬───────┘
                          │ 挂进 Context
              ┌───────────┼───────────┐
              ▼                       ▼
         index.ts              tui/agent.tsx
    yield* ConfigService   yield* ConfigService
        各自从 Context 取，不用传参
```

核心思想：**把"造依赖"和"用依赖"分开**——在唯一的地方造，用到的地方自取。

## Service 三件套：接口、标签、实现

Effect 的 DI（依赖注入）需要三个东西配合，缺一不可。用现实世界类比来理解：

```
你去公司上班，需要一张工卡。
  1. 工卡上写了"职位：工程师"      ← 这是 Interface（声明能做什么）
  2. 工卡本身是"门禁系统认识的物件"   ← 这是 Tag（系统用它识别你）
  3. HR 系统里录入了你的信息         ← 这是 Layer（怎么造出这张工卡）
```

现在看代码怎么对应：

### 1. Interface：能力清单

```typescript
export interface ConfigServiceApi {
  readonly get: () => Effect.Effect<Config>
}
```

就是一个普通的 TypeScript interface。它回答一个问题：**"这个服务能做什么？"**。ConfigService 只提供一个方法 `get()`，返回 Config。

### 2. Tag：存取服务的钥匙

```typescript
export class ConfigService extends Context.Service<
  ConfigService,        // 第一个参数：自己（类型自引用，固定写法）
  ConfigServiceApi      // 第二个参数：能力清单（就是上面那个 interface）
>()("opencode-from-scratch/Config") {}  // 全局唯一 ID
```

**这行代码不创建任何实例**。它只是向 Effect 注册了一个"标签"。

标签的作用类似 key-value 存储里的 key：

```
Context（类似一个大 Map）
┌─────────────────────────────────┐
│ ConfigService  →  { get: fn }   │  ← Tag 是 key，实例是 value
│ ProviderService →  { chat: fn } │
│ ToolRegistry    →  { list: fn } │
└─────────────────────────────────┘
```

后续用 `yield* ConfigService` 就是拿这个 key 去 Context 里查 value。

### 3. Layer：具体实现

```typescript
export const configLayer = Layer.effect(
  ConfigService,        // 这个 Layer 为哪个 Tag 提供实现
  Effect.gen(function* () {
    // 这里是"怎么造"——读文件，解析配置
    const raw = yield* Effect.promise(() => Bun.file("opencode.json").json())
    const [providerID, modelID] = raw.model.split("/")
    const provider = raw.provider[providerID]

    const config: Config = {
      baseURL: provider.baseURL,
      apiKey: provider.apiKey,
      modelID,
    }

    // ConfigService.of(...) 把实现对象和 Tag 绑定，存进 Context
    return ConfigService.of({
      get: () => Effect.succeed(config),  // config 已经缓存在闭包里
    })
  }),
)
```

`Layer.effect` 的函数体**只跑一次**——在 `Effect.provide(configLayer)` 时执行。之后所有 `yield* ConfigService` 拿到的都是同一个实例。

## 三件套的协作流程

```
定义阶段（写代码时）：
  Interface（ConfigServiceApi）  ──声明能力──→  "get() 返回 Config"
  Tag（ConfigService）          ──注册标签──→  Context 里的 key
  Layer（configLayer）          ──绑定实现──→  "读 opencode.json 造 Config"

运行阶段（runPromise 时）：
  Effect.provide(configLayer)   ──执行 Layer 体──→  读文件，造实例
                                                  ConfigService.of({...})
                                                  ↓
                                              挂进 Context
                                                  ↓
  yield* ConfigService          ──查 Context──→  拿到实例，调 get()
```

## 你起的名字 vs Effect 库提供的

| 名字 | 谁起的 | 作用 |
|------|--------|------|
| `ConfigServiceApi` | 你 | 声明能力（interface） |
| `ConfigService` | 你 | 标签（class） |
| `configLayer` | 你 | 实现（const） |
| `Context.Service` | Effect 库 | 造标签的工具函数 |
| `Layer.effect` | Effect 库 | 造 Layer 的工具函数 |
| `ConfigService.of` | Effect 库自动生成 | 把实现绑定到标签 |

记住：**你只需要给三个东西起名字**（Api、Service、Layer），剩下的固定写法照抄。

## 跑一下

```bash
bun run src/service-demo.ts
```

打开 `src/service/config.ts` 对照三件套的定义位置。