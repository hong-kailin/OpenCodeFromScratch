# 11.4 阶段验收

## 一图总结：Service + Layer 全流程

```
┌─ 定义阶段（写代码）──────────────────────────────────┐
│                                                      │
│  Interface           Tag                Layer         │
│  ConfigServiceApi    ConfigService      configLayer   │
│  "能做什么"          "叫什么名字"        "怎么造"       │
│      │                   │                  │        │
│      └───────────────────┴──────────────────┘        │
│                      三件套绑定                        │
└──────────────────────────────────────────────────────┘
                        │
                        ▼
┌─ 装配阶段（provide）─────────────────────────────────┐
│                                                      │
│  providerLayer ──需要──→ ConfigService               │
│       │                      ↑                      │
│       │  Layer.provide(configLayer)  ← 显式喂依赖    │
│       ▼                      │                      │
│  satisfiedProvider  ←───────┘                       │
│       │                                              │
│       ├── Layer.mergeAll ── configLayer              │
│       └── Layer.mergeAll ── toolRegistryLayer        │
│                    │                                  │
│                    ▼                                  │
│              appLayers                                │
└──────────────────────────────────────────────────────┘
                        │
                        ▼
┌─ 运行阶段（runPromise）──────────────────────────────┐
│                                                      │
│  ① 跑各 Layer 的函数体，造实例，挂进 Context          │
│                                                      │
│     Context                                          │
│     ┌──────────────────────────┐                     │
│     │ ConfigService → {get}    │                     │
│     │ ProviderService → {chat} │                     │
│     │ ToolRegistry → {list}    │                     │
│     └──────────────────────────┘                     │
│                                                      │
│  ② 跑 program 函数体，消费者 yield* 自取             │
│                                                      │
│     printModel()  ──yield* ConfigService──→ {get}    │
│     printBaseURL()──yield* ConfigService──→ {get}    │
│                    拿到的是同一个实例                  │
└──────────────────────────────────────────────────────┘
```

## 验收清单

- [ ] 能写出 Service 三件套：Interface + Context.Service tag + Layer.effect 实现
- [ ] 能解释 `yield* Service` 做了什么——从 Context 取服务实例
- [ ] 能解释 `Effect.provide(layer)` 做了什么——跑 Layer 函数体，挂实例进 Context
- [ ] 理解 Layer 函数体只跑一次，所有消费者共享同一份实例
- [ ] 能处理 Layer 依赖：`providerLayer.pipe(Layer.provide(configLayer))` 显式喂
- [ ] 知道 `mergeAll` 不会自动解析 Layer 依赖，直接合并会 typecheck 报错

## 验证方式

```bash
# 11.1-11.2：Service 基本用法
bun run src/service-demo.ts

# 11.3：Layer 依赖链
bun run src/service/layer-deps-demo.ts
```

## 工程思维

**DI 的核心转变**：

```
"我需要什么，调用方给我"（传参）
      ↓
"我需要什么，我自己从 Context 取"（yield* Service）
```

**为什么这么设计？** 三个好处：

1. **签名不膨胀**：加新依赖时，消费方函数签名不变。`runAgentLoop(messages, callbacks)` 永远是这个签名，内部加 `yield* NewService` 就行。
2. **单点构造**：依赖只在一个地方造（Layer），换实现只改一处。
3. **编译期安全**：忘记 provide 会在 typecheck 阶段暴露，不会等到运行时。

## 阶段产出

```
src/
├── service/
│   ├── config.ts              # ConfigService 三件套
│   ├── provider.ts            # ProviderService（依赖 ConfigService）
│   ├── tool-registry.ts       # ToolRegistry（无依赖）
│   └── layer-deps-demo.ts     # Layer 依赖链演示
├── service-demo.ts            # 消费与提供演示
```

## 下一步

阶段 12：用 Effect 重构 agent loop——把阶段 11 学到的 Service/Layer 应用到 agent loop，合并 CLI 和 TUI 的两个重复 loop。