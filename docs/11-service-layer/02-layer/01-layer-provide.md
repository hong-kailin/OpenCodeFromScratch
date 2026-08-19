# 11.2 Layer 提供实现：消费与提供

> 对照代码：`src/service-demo.ts`

## 消费：yield\* Service

在 `Effect.gen` 里，用 `yield* Service` 从 Context 取服务实例：

```typescript
function printModel() {
  return Effect.gen(function* () {
    const config = yield* ConfigService  // 从 Context 取 ConfigService 实例
    const { modelID } = yield* config.get()  // 调 get() 拆出 Config
    console.log("modelID:", modelID)
  })
}
```

**注意**：`yield*` 了两次——
1. `yield* ConfigService` → 从 Context 取出服务实例
2. `yield* config.get()` → 调用服务方法，拆出 Config 值

两次 `yield*` 对应两层"盒子"：外层是服务实例，内层是方法的返回值。

## 提供：Effect.provide(layer)

服务的实例由 Layer 在 `Effect.provide` 时造出来。看完整流程：

```typescript
const program = Effect.gen(function* () {
  yield* printModel()   // 内部 yield* ConfigService
  yield* printBaseURL() // 内部也 yield* ConfigService
})

// 装配 + 执行
await Effect.runPromise(
  program.pipe(Effect.provide(configLayer))
)
```

## 执行顺序：拆成 4 步走

> 对照 `src/service-demo.ts` 底部 4 步注释

```
第 1 步：Effect.provide(configLayer)
         ┌─────────────────────────────────┐
         │ 返回一个函数 withConfig          │
         │ 此刻：什么都没执行                │
         │ 文件没读，Layer 体没跑            │
         └─────────────────────────────────┘

第 2 步：program.pipe(withConfig)
         ┌─────────────────────────────────┐
         │ 返回一个新 Effect stored          │
         │ 此刻：还是什么都没执行             │
         │ stored = "先跑 Layer, 再跑 program"│
         └─────────────────────────────────┘

第 3 步：Effect.runPromise(stored)  ← 点火！
         ┌─────────────────────────────────┐
         │ ① 跑 configLayer 的 Effect.gen 体 │
         │    - 读 opencode.json            │
         │    - 解析出 Config                │
         │    - ConfigService.of({...})     │
         │    - 挂进 Context                │
         │                                 │
         │ ② 跑 program 的 Effect.gen 体    │
         │    - printModel():               │
         │      yield* ConfigService        │
         │      → 从 Context 取出实例        │
         │      → config.get() 拿到 Config  │
         │      → 打印 modelID              │
         │    - printBaseURL(): 同样自取     │
         └─────────────────────────────────┘

第 4 步：await running
         等 Promise 完成
```

## 关键：provide 一次，到处可取

```
configLayer 函数体只跑一次
         │
         ▼
   ConfigService 实例挂进 Context
         │
    ┌────┴────┐
    ▼         ▼
printModel  printBaseURL
两个消费者拿到的是同一个实例
```

验证：`service-demo.ts` 输出中，两个消费者都打印了 config，但文件只读了一次。

## 延迟性：每次 run 都是新的

```typescript
await Effect.runPromise(stored)  // 第一次：读文件，造实例 A，跑 program
await Effect.runPromise(stored)  // 第二次：又读文件，造实例 B，跑 program
```

`stored` 是描述，不是结果。类比：stored 像菜谱，每次照着做菜都要重新备料。

## 跑一下

```bash
bun run src/service-demo.ts
```

观察输出顺序：两个消费者打印 → "文件只读了一次"。注意第二次 run 时文件又被读了一次。