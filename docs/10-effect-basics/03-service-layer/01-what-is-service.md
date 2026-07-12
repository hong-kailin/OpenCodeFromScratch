# 10.3 先看全貌：什么是 Service

> 本课拆成 4 个文件，这是第 1 个。先跑通代码、看到效果，不深究每行。后面三个文件再逐个拆解。

## 回顾：我们要解决什么

10.1 课发现 config 有个烦人的问题：`loadConfig()` 在 `index.ts` 和 `agent.tsx` 各调一次，每次都重新读文件。TUI 里更离谱--每发一条消息就读一遍配置文件。

我们想要的是"工具管理处"：config 读一次、存好，谁需要谁自己去拿，不用每次重读、不用参数层层传。

Effect 的 **Service + Layer** 就是干这个的。本节先用它，看到效果，下节再拆原理。

## 三件套长什么样

打开 `src/service/config.ts`，核心就三块（现在看不懂没关系，先扫一眼）：

```ts
// 第 1 块：声明这个服务能做什么（叫 ConfigServiceApi）
export interface ConfigServiceApi {
  readonly get: () => Effect.Effect<Config>
}

// 第 2 块：给服务起个唯一标识（叫 ConfigService）
export class ConfigService extends Context.Service<ConfigService, ConfigServiceApi>()(
  "opencode-from-scratch/Config",
) {}

// 第 3 块：服务的具体实现--读文件、缓存（叫 configLayer）
export const configLayer = Layer.effect(
  ConfigService,
  Effect.gen(function* () {
    const raw = yield* Effect.promise(async () => {
      return await Bun.file("opencode.json").json()
    })
    // ...解析...
    return ConfigService.of({
      get: () => Effect.succeed(config),  // config 已缓存，直接给
    })
  }),
)
```

三块名字（`ConfigServiceApi`、`ConfigService`、`configLayer`）是我们自己起的，不是 effect 的关键字。`Context.Service`、`Layer.effect` 才是 effect 库提供的固定写法。这些下节细讲。

## 怎么用：yield* 取，provide 给

用服务就两步。先说两个英文词的意思（后面会反复用到）：
- **yield**：英文"产出、交出"的意思。`yield* ConfigService` 就是"把 ConfigService 交给我"。
- **provide**：英文"提供"的意思。`Effect.provide(configLayer)` 就是"把 config 的实现提供给这个程序"。就像工人上岗前，管理处把工具发给他。

**第 1 步：谁需要 config，就用 `yield* ConfigService` 自己取**

```ts
function printModel() {
  return Effect.gen(function* () {
    const config = yield* ConfigService       // 自己取，不用参数传进来
    const { modelID } = yield* config.get()
    console.log("modelID:", modelID)
  })
}
```

**第 2 步：把多个消费者串成主程序，provide 一次**

```ts
// program 是主程序：把两个消费者串起来
const program = Effect.gen(function* () {
  yield* printModel()    // 消费者 1
  yield* printBaseURL()  // 消费者 2
})

// provide 把 configLayer 塞进去，然后 run
await Effect.runPromise(program.pipe(Effect.provide(configLayer)))
```

`program` 就是把两个消费者串起来的主 Effect。`Effect.provide(configLayer)` 在 run 之前把 config 的实现塞进去。之后 program 里所有 `yield* ConfigService` 都能取到 config。文件只读一次（在 provide 时），所有消费者共享。

## 跑一下

```bash
bun run src/service-demo.ts
```

输出：
```
消费者 1 拿到 modelID: deepseek-v4-flash
消费者 2 拿到 baseURL: https://ark.cn-beijing.volces.com/api/coding/v3
两个消费者都拿到了 config，但文件只读了一次（在 Layer 里缓存）
```

两个消费者都拿到了 config，但文件只读了一次。这就是"工具管理处"的效果。

## 本节小结

现在你只需要知道：

1. **Service 是全局共享的东西**：config 读一次，谁需要谁自取
2. **三件套**：`ConfigServiceApi`（能做什么）+ `ConfigService`（标识）+ `configLayer`（实现）
3. **用法**：`yield* ConfigService` 取，`Effect.provide(configLayer)` 给

每行代码具体什么意思、为什么这么写，下两节拆。

---

下一步：[10.3 Context 与三件套拆解](./02-three-pieces.md)
