# 10.3 Context 与三件套拆解

> 第 2 个文件。上节跑了 demo 看了效果，这节拆开讲：Context 是什么、三件套每块干什么。

## Context：装服务的容器

上节说"谁需要谁自取"--从哪取？从一个叫 **Context** 的东西里取。

把 Context 想象成工具间里的一面挂墙，墙上有很多挂钩：

```
Context（挂墙）
┌──────────────────────────────────────┐
│  [ConfigService 标签] → config 实例   │  ← 挂钩 1
│  [以后别的服务]      → ...           │  ← 挂钩 2
└──────────────────────────────────────┘
```

- **挂上去** = `Effect.provide(configLayer)`（管理处把工具挂上墙）
- **取下来** = `yield* ConfigService`（工人伸手取）

Context 你不用手动传，它跟着 Effect 自动走。函数里 `yield* ConfigService` 能取到服务，就是因为那一刻 Context 和 Effect 在一起。

## 三件套逐个拆

### 第 1 块：ConfigServiceApi -- 能做什么

```ts
export interface ConfigServiceApi {
  readonly get: () => Effect.Effect<Config>
}
```

这就是一个普通的 TypeScript interface，声明"这个服务能做什么"。`ConfigServiceApi` 是我们自己起的名字，叫什么都行。这里声明只有一个能力：`get()`，返回 Config。

`get()` 的返回值是 `Effect.Effect<Config>` 而不是直接 `Config`--因为取 config 可能失败（文件不存在），Effect 把"可能失败"编进类型。调用方要用 `yield*` 拆开（10.2 课的拆盒子）。

### 第 2 块：ConfigService -- 挂钩标签

```ts
export class ConfigService extends Context.Service<ConfigService, ConfigServiceApi>()(
  "opencode-from-scratch/Config",
) {}
```

这行最吓人，但**你不需要完全看懂它**。它就是一个固定模板，照抄就行。我来解释每个部分：

- `class ConfigService` -- 定义一个类，名字我们自己起的
- `extends Context.Service<...>()("...")` -- `Context.Service` 是 effect 库提供的函数，固定写法
- `<ConfigService, ConfigServiceApi>` -- 两个类型参数：第一个是自己，第二个是上一步的能力清单
- `("opencode-from-scratch/Config")` -- 全局唯一 ID，调试时能在报错里看到

**这个类本身不是服务实例，只是一个"标签"**--像挂钩上的铭牌，写着"这里挂 ConfigService"。真正的实例是第 3 块造的。

怎么理解"标签 vs 实例"？"锤子"这个词是标签，"我手里这把锤子"是实例。`yield* ConfigService` 取的是"挂在 ConfigService 标签下的实例"。

### 第 3 块：configLayer -- 造实例

```ts
export const configLayer = Layer.effect(
  ConfigService,
  Effect.gen(function* () {
    const raw = yield* Effect.promise(async () => {
      return await Bun.file("opencode.json").json()
    })
    // ...解析 config...
    return ConfigService.of({
      get: () => Effect.succeed(config),
    })
  }),
)
```

`configLayer` 是我们自己起的变量名。`Layer.effect` 是 effect 库的函数，固定写法。意思是"用这个 Effect.gen 造出 ConfigService 的实现"。

Effect.gen 体里干的事：
1. 读一次 opencode.json
2. 解析出 config
3. `ConfigService.of({ get: ... })` 把实现包装成服务实例（`.of` 是 effect 库自动给类加的方法，不是我们写的）

#### 关键：Layer 体只跑一次

这是整个设计的核心。`Layer.effect` 的 Effect.gen 体**只在 provide 时执行一次**，造出一个实例存进 Context。之后所有 `yield* ConfigService` 拿到的都是这同一个实例。

```
旧方式（loadConfig）：调 10 次 = 读 10 次文件
新方式（Layer）：     provide 时读 1 次，之后取 10 次都不读
```

这就是"工具造一次，挂上墙，谁要谁取，不重复造"。痛点 1（重复读文件）就这么解决的。

## 本节小结

1. **Context 是挂墙**：装服务实例的容器，跟着 Effect 自动走，不用手动传
2. **ConfigServiceApi**：能力清单，普通 interface，我们自己起的名字
3. **ConfigService**：挂钩标签，`Context.Service<...>()("id")` 是固定模板，照抄就行
4. **configLayer**：造实例，Layer 体只跑一次 = 缓存

---

下一步：[10.3 怎么用：取与给](./03-consume-provide.md)
