# 16.7 第 7 步：上层接入 + 验收——opencode 包从 core 取全部服务

> 对照代码：`packages/opencode/src/index.ts`（CLI）、
> `packages/opencode/src/tui/agent.tsx`（TUI）

## 这一步做什么

前面 6 步把领域逻辑全部服务化并搬进 core 包，但上层（CLI/TUI）还在用
**兼容层**（模块级函数导出）。这步把上层真正改成 `yield* core 服务`，
然后删除所有兼容层，最后验收。

## 当前状态：兼容层还顶着

16.2-16.5 服务化时，为了不让中间态跑不起来，我们留了兼容层：
- `database.ts` 里的模块级 `db` 导出
- `store.ts` 里的 `createSession()` 等模块级函数
- `system-context.ts` 里的 `buildSystemPrompt()`

这些兼容层让 CLI 暂时还能跑，但**它们绕过了服务**（直接构造实例）。
这一步全部删掉，让上层只通过服务访问。

## 改造 CLI（index.ts）：整体变成 Effect

**核心改动**：handler 从 async 函数变成 `Effect.fn("runCommand")`，内部 `yield*` 服务。

```typescript
// 之前：调用模块级函数
const session = await getSession(args.session)
const history = await loadMessages(sessionId)
const prompt = buildSystemPrompt()

// 现在：yield* 服务
const store = yield* SessionStore
const sysCtx = yield* SystemContext
const session = yield* store.get(args.session)
const history = yield* store.loadMessages(sessionId)
const prompt = yield* sysCtx.build()
```

Layer 组装加入新服务：

```typescript
const satisfiedProvider = providerLayer.pipe(Layer.provide(configLayer))
const satisfiedSessionStore = sessionStoreLayer.pipe(Layer.provide(databaseLayer))
const appLayers = Layer.mergeAll(
  configLayer,
  satisfiedProvider,
  toolRegistryLayer,
  fileSystemLayer,
  satisfiedSessionStore,
  systemContextLayer,
)
```

## ⚠️ 两个容易踩的坑

### 坑 1：onMessage 回调里不能用 Effect.runSync 跑异步

CLI 的持久化通过 onMessage 回调存消息：

```typescript
// ❌ 错误：saveMessage 是异步 Effect，runSync 会报错
onMessage(msg) {
  Effect.runSync(store.saveMessage(sessionId, msg))
}
// error: An asynchronous Effect was executed with Effect.runSync

// ✅ 正确：用 Effect.runPromise（不阻塞 agent loop）
onMessage(msg) {
  void Effect.runPromise(store.saveMessage(sessionId, msg))
}
```

**理解**：`runSync` 只能跑同步 Effect；saveMessage 内部是数据库写（异步）。
回调里 fire-and-forget（`void` + `runPromise`）最合适——不需要等它完成。

### 坑 2：Effect.fn 返回的是"函数"，要调用才得到 Effect

```typescript
const program = Effect.fn("runCommand")(function* () { ... })

// ❌ 错误：program 是函数，不是 Effect
Effect.runPromise(program.pipe(Effect.provide(appLayers)))

// ✅ 正确：program() 调用后才得到 Effect
Effect.runPromise(program().pipe(Effect.provide(appLayers)))
```

`Effect.fn("Name")(fn)` 返回一个普通函数（带 trace 名），调用它才得到 Effect。
这是 opencode 的标志性模式——函数名出现在 fiber trace 里，方便调试。

## 改造 TUI（agent.tsx）

TUI 不需要持久化，所以只需要 SystemContext：

```typescript
// 之前：buildSystemPrompt() 模块级函数
const internalMessages = [
  { role: "system", content: buildSystemPrompt() },
  { role: "user", content: text },
]

// 现在：yield* SystemContext
await Effect.runPromise(
  Effect.gen(function* () {
    const sysCtx = yield* SystemContext
    const prompt = yield* sysCtx.build()
    const internalMessages = [
      { role: "system", content: prompt },
      { role: "user", content: text },
    ]
    yield* runAgentLoop(internalMessages, { ... })
  }).pipe(Effect.provide(appLayers)),
)
```

## 删除兼容层

上层全部走服务后，删掉兼容层：
1. `database.ts` 底部的模块级 `db` 导出
2. `store.ts` 底部的 `createSession()` 等模块级函数
3. `system-context.ts` 底部的 `buildSystemPrompt()`

同时从 barrel（core/src/index.ts）移除这些导出。删完 typecheck，确保没有残留引用。

## 验证：阶段 16 最终验收

```bash
bunx tsc --noEmit                                        # 1. 类型全通过
bun run packages/opencode/src/index.ts run "2+2?"        # 2. CLI 跑通
bun run packages/opencode/src/index.ts run -c "1+1?"     # 3. 会话恢复（走 SessionStore）
bun run packages/core/src/database/database-demo.ts      # 4. Database 服务 demo
```

验收清单：
- [x] `packages/{schema, core, opencode}` 三层结构
- [x] core 包：6 个领域服务（Database/FileSystem/ToolRegistry/SessionStore/SystemContext/Provider）
- [x] opencode 包：只留入口层，从 `@opencode-from-scratch/core` 取服务
- [x] 无兼容层残留（模块级 db / createSession / buildSystemPrompt 全删）
- [x] typecheck 通过、CLI/TUI 跑通、功能与阶段 15 一致

## 工程思维总结（阶段 16 学到了什么）

**1. 服务化的本质 = 把"依赖关系"显式化**
之前：模块级函数直接 import 单例，依赖隐藏在 import 语句里。
现在：`yield* Service` 声明"我需要什么"，Layer 提供"怎么造"。
依赖关系从"代码里偶然的 import"变成"类型里强制的声明"。

**2. R 泛型 = 编译期的依赖检查**
工具的 `Tool<typeof Parameters, FileSystemService>` 在编译期就告诉你：
执行这个工具需要 FileSystem 服务。忘了 provide？编译器拒绝通过。

**3. "副作用收进 Layer" = 可替换性的前提**
建库、建表、文件读写，这些副作用全在 Layer 里。provide 谁，就用谁的实现。
测试时换 Layer 提供假实现，业务代码一行不改——这就是依赖注入的价值。

**4. 渐进式的迁移策略**
先搬移（纯工程量，风险低）→ 逐个服务化（每步一个可验证增量）→
留兼容层顶着（中间态能跑）→ 最后接入 + 删兼容层（收尾）。
每一步都能 typecheck + 运行，不会出现"改一半跑不起来"的境地。

## 对照 opencode

| 我们 | opencode |
|------|----------|
| core 包 6 个服务 | `packages/core` 50+ 文件、每个领域一个 Service |
| FileSystem 服务（简化） | `filesystem.ts`（含 location/realPath 安全校验） |
| SystemContext 单服务 | `system-context/`（registry 模式，多组件注册） |
| SessionStore（直接 CRUD） | `session/store.ts`（事件溯源，阶段 17） |
| 工具 execute Effect 化 | opencode 的 Tool.execute 返回 Effect |

阶段 16 建立了"领域服务层"。阶段 17（事件溯源）会把 SessionStore 重构成事件流驱动，
阶段 18（Route）会把 Provider 升级成四轴模型——都在 core 包的基础上演进。
