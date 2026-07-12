# 10.3 类型安全与对照 opencode

> 第 4 个文件。前三节讲了怎么定义和用 Service。这节讲一个进阶好处：类型安全怎么帮你防错。看不懂可以跳过，不影响用。

## Effect 的三个类型参数

Effect 的完整类型是 `Effect<Success, Error, Requirements>`：

- `Success`：成功时产出什么（比如 `Config`、`void`）
- `Error`：失败时抛什么（`never` 表示不会失败）
- `Requirements`：**需要从 Context 取哪些服务**（`never` 表示不需要）

第三个参数 `Requirements` 是 Effect 独有的，Promise 没有它。它记录"这个 Effect 依赖哪些服务"。

## 类型怎么变化

跟着 `service-demo.ts` 走一遍：

**`printModel()` 用了 `yield* ConfigService`，所以它需要 ConfigService：**
```
Effect<void, never, ConfigService>
                ↑ 需要 ConfigService
```

**`program` 组合了两个这样的函数，也需要 ConfigService：**
```
Effect<void, never, ConfigService>
```

**`provide(configLayer)` 把 ConfigService 消除了：**
```
Effect<void, never, ConfigService>     ← provide 前：需要
                  ↓ provide
Effect<void, never, never>             ← provide 后：不需要了
```

为什么能消除？因为 provide 把实例塞进了 Context，执行时能取到，不再"需要"外部提供。

**`runPromise` 要求 Requirements 是 never：**

如果还有未满足的需求，`runPromise` 不知道去哪找那些服务，没法跑。所以所有需求必须在 run 前 provide 完。

## 忘了 provide 会怎样

如果你忘了 provide，typecheck 直接报错："还有 ConfigService 没提供，不能 runPromise"。

**这就是 Effect 类型安全的好处：忘提供依赖，编译期就抓住，不用等程序跑到一半崩。**

这也是 `service-demo.ts` 里函数不写返回类型标注的原因--如果手写 `: Effect.Effect<void>`，TS 会把 Requirements 当成 `never`，和实际不符，typecheck 报错。让 TS 自己推断就行。

## 对照 opencode

opencode 的 `core/src/session/store.ts` 也是三件套，结构和我们一样，只是名字不同：

```ts
// opencode 用的名字          // 我们改的名字
export interface Interface {}  // ConfigServiceApi
export class Service {}        // ConfigService
const layer = Layer.effect()   // configLayer
```

opencode 用 `Interface`/`Service`/`layer` 这些名字，我们改成了 `ConfigServiceApi`/`ConfigService`/`configLayer`，是为了不和 effect 库的 `Context.Service`、`Layer` 混淆。结构完全一样，读 opencode 源码时对应着看就行。

opencode 的 Layer 里有一行 `yield* Database.Service`--说明 **Layer 里也能取别的服务**。SessionStore 需要 Database，就在 Layer 里取。Layer 之间也有依赖关系，后面 10.4 课会用到这个。

## 本课小结

1. **Context 是挂墙**：装服务实例，跟着 Effect 自动走
2. **三件套**：ConfigServiceApi（能做什么）+ ConfigService（标签，照抄模板）+ configLayer（造实例，只跑一次 = 缓存）
3. **用法**：`yield* ConfigService` 取，`Effect.provide(configLayer)` 给
4. **类型安全**：Requirements 记录依赖，provide 消除，忘 provide 编译期报错

ConfigService 还没接入真实的 `index.ts` 和 `agent.tsx`--那需要把入口改成 Effect 化，是 10.4 课的主题。

---

下一步：[10.4 用 Service 重构 agent loop](../04-refactor-agent-loop/01-refactor-agent-loop.md) -- ProviderService + ToolRegistry，agent loop 从 Context 取依赖。
