# 10.3 怎么用：取与给

> 第 3 个文件。上节讲了三件套怎么定义，这节讲怎么用：yield* 取服务、provide 给服务。

## 取服务：yield* 拆两层盒子

看 `src/service-demo.ts`。消费者这样用 ConfigService：

```ts
function printModel() {
  return Effect.gen(function* () {
    const config = yield* ConfigService       // 第一步
    const { modelID } = yield* config.get()   // 第二步
    console.log("modelID:", modelID)
  })
}
```

这里有两步，别搞混：

**第一步：`yield* ConfigService` -- 取服务实例**

ConfigService 是标签。`yield* ConfigService` 就是从 Context 挂墙上取下挂在 ConfigService 标签下的实例。取出来的是一个服务对象，有 `get()` 方法。

**第二步：`yield* config.get()` -- 取真正的值**

`config.get()` 返回 `Effect.Effect<Config>`（一个装着 Config 的盒子）。`yield*` 拆开盒子，拿到 Config 对象。

简单说：
- 第一步取**服务对象**（从挂墙上取）
- 第二步取**真正的数据**（调服务的方法，拆返回值的盒子）

**函数不接收 config 参数，而是自己从 Context 取。** 这就是"自取"而非"传参"--解决了 10.1 课的痛点 4。

## 给服务：Effect.provide

消费者用 `yield* ConfigService` 取服务，但服务实例从哪来？得有人先"挂上墙"。这步叫 provide：

```ts
await Effect.runPromise(program.pipe(Effect.provide(configLayer)))
```

`Effect.provide(configLayer)` 干两件事：
1. 跑 configLayer 的 Effect.gen 体，读文件、造出服务实例
2. 把实例存进 Context（挂上墙）

之后 program 执行时，遇到 `yield* ConfigService` 就能从 Context 取到。

**provide 一次，全局共享**：demo 里 `printModel()` 和 `printBaseURL()` 两个消费者共享同一份 config，文件只读一次。

这就是 10.2 课说的"延迟性的好处"--Effect 是延迟的描述，你才能在 run 之前 provide 装配依赖。如果 Effect 像 Promise 创建即执行，你根本没机会在"创建"和"执行"之间塞依赖。

## 对比：之前 vs 现在

```
之前（10.1 痛点）：
  const config = await loadConfig()   // 每次都读文件
  printModel(config)                   // 手动传参
  printBaseURL(config)                 // 手动传参

现在（Service/Layer）：
  yield* printModel()                  // 不用传参，内部自取
  yield* printBaseURL()                // 不用传参，内部自取
```

| | 之前 | 现在 |
|---|------|------|
| 读文件 | 每次调都读 | provide 时读一次，缓存 |
| 传递 | 参数层层传 | yield* 从 Context 自取 |
| 共享 | 各读各的 | provide 一次，全局共享 |
| 可替换 | 改 loadConfig | 换个 Layer provide（测试 mock） |

## 本节小结

1. **yield\* 取两层**：第一层从 Context 取服务对象，第二层调方法取真正的值
2. **provide 给**：run 之前 provide Layer，造实例存进 Context
3. **不用传参了**：函数自己从 Context 取，解决痛点 4

---

下一步：[10.4 类型安全与对照 opencode](./04-type-safety.md)
