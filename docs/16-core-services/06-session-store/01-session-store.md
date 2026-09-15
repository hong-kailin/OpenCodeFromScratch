# 16.6 SessionStore 服务：session + message 合并成一个服务

> 阶段 16 的地图见 [16.0 总览](../00-overview/01-overview.md)。
> 本课把散成两个文件的存储逻辑合并成 SessionStore Service，
> 同时退役 16.2 的过渡桥接——"存储归谁管"这个问题终于有了答案。

## 这一步做什么

把 `session.ts`（4 个函数）+ `message.ts`（2 个函数）合并成一个 **SessionStore Service**：
session CRUD + message 存取，全部 Effect 化，依赖 Database Service。

对照代码：`packages/core/src/session/store.ts`（新建）、
`packages/core/src/session/session.ts` + `message.ts`（删除）、
`packages/opencode/src/index.ts`（改造）

## 之前的问题

16.2 时遗留的问题（16.0.1 的三个问题之一）：

1. **职责分散**——session CRUD 在 `session.ts`，message 存取在 `message.ts`，
   "存储"这个能力没有统一归属
2. **模块级函数 + 模块级 db**——直接 `import { db }`，无法替换实现
3. **过渡桥接还挂着**——16.2 为了不让它们破，`database.ts` 末尾留了一个
   模块级 `export const db = Effect.runSync(...)` 桥接，现在该退役了

## 解法：SessionStore Service

```typescript
// packages/core/src/session/store.ts
export interface SessionStoreApi {
  // session CRUD
  readonly create: (title?: string) => Effect.Effect<Session>
  readonly list: () => Effect.Effect<Session[]>
  readonly get: (id: string) => Effect.Effect<Session | undefined>
  readonly update: (id: string, title: string) => Effect.Effect<void>
  // message 存取
  readonly saveMessage: (sessionId: string, msg: Message) => Effect.Effect<void>
  readonly loadMessages: (sessionId: string) => Effect.Effect<Message[]>
}

export class SessionStore extends Context.Service<SessionStore, SessionStoreApi>()(
  "opencode-from-scratch/SessionStore",
) {}

export const sessionStoreLayer = Layer.effect(
  SessionStore,
  Effect.gen(function* () {
    // 依赖 Database Service——从 Context 拿 db（Layer 依赖 Layer）
    const { db } = yield* DatabaseService

    return SessionStore.of({
      create: Effect.fn("SessionStore.create")(function* (title?: string) {
        // insert 返回 Promise → Effect.promise 桥接
        yield* Effect.promise(() => db.insert(sessionTable).values(session))
        return session
      }),
      list: Effect.fn("SessionStore.list")(function* () {
        // 但 .all() 是同步的（bun-sqlite）→ Effect.sync 包
        return yield* Effect.sync(() =>
          db.select().from(sessionTable).orderBy(desc(sessionTable.time_updated)).all(),
        )
      }),
      // ... get / update / saveMessage / loadMessages
    })
  }),
)
```

三个要点：

1. **合并**——原来两个文件的函数变成六个方法，存储能力一个服务全包了
2. **Effect 化**——每个方法都返回 Effect。注意 drizzle 的 `.insert/.update`
   返回 Promise（用 `Effect.promise`），而 `.all()/.get()` 在 bun-sqlite 下
   是**同步**的（用 `Effect.sync`）——包错会报"没有 then 方法"
3. **依赖 Database**——`yield* DatabaseService` 拿 db，这就是 11.3 课的
   "Layer 依赖 Layer"（和 16.2 的桥接相比，这里不再需要手动取 db）

## 退役过渡桥接

16.2 在 `database.ts` 末尾留的桥接：

```typescript
export const db = Effect.runSync(
  Effect.provide(
    DatabaseService.pipe(Effect.map((service) => service.db)),
    databaseLayer,
  ),
)
```

现在 SessionStore 直接从 Context 取 db，**没有人再需要模块级 `db` 了**。
删掉它——16.2 的"过渡方案"正式完成使命。

> 这就是重构里的"技术债还清"：桥接存在的唯一理由是让旧代码不破，
> 一旦新结构就位，桥接就删除。**别让过渡代码变成永久代码**。

## CLI 入口改造：yield* SessionStore

`index.ts` 的 handler 从 async 函数变成 Effect.fn，存储调用全部走服务：

```typescript
const program = Effect.fn("runCommand")(function* () {
  // 从 Context 取存储服务
  const store = yield* SessionStore

  // 之前：const session = await createSession()
  // 现在：
  const session = yield* store.create()
  // 之前：const history = await loadMessages(sessionId)
  // 现在：
  const history = yield* store.loadMessages(sessionId)
  // ...
})
```

持久化回调里有个细节：`onMessage` 是**同步回调**，但 `saveMessage` 是异步 Effect，
不能在里面 `yield*`。用 `Effect.runPromise` 异步执行（不阻塞 agent loop）：

```typescript
onMessage(msg) {
  // 不能 Effect.runSync（saveMessage 是异步的，会报错），用 runPromise
  void Effect.runPromise(store.saveMessage(sessionId, msg))
}
```

入口 Layer 组装也要把 SessionStore 接上（依赖 Database）：

```typescript
const satisfiedSessionStore = sessionStoreLayer.pipe(Layer.provide(databaseLayer))
const appLayers = Layer.mergeAll(
  // ...
  satisfiedSessionStore,
  // ...
)
```

## 教 debug

**场景**：typecheck 报 `Property 'create' does not exist on type ...`。

排查：`yield* SessionStore` 拿到的是 Service 实例（有 create/list/get 等方法），
不是 DatabaseService。确认 yield* 的是对的服务 tag。

**场景**：运行时 `An asynchronous Effect was executed with Effect.runSync`。

排查：这是持久化回调里用 `Effect.runSync(store.saveMessage(...))` 的报错。
saveMessage 内部有 Promise（db.insert），runSync 只能跑同步 Effect。
改成 `Effect.runPromise`（异步执行，不阻塞）。

## 验证：这一步成功标志

```bash
bunx tsc --noEmit
bun run packages/opencode/src/index.ts run "2+2=?"     # 新建会话 + 持久化
bun run packages/opencode/src/index.ts run -c "刚才的问题你回答了什么？"
# 期望：恢复会话显示历史消息数，AI 记得上下文（回答 4）——loadMessages 工作
```

## 这一步解决了什么

| 问题 | 解决了吗 | 说明 |
|------|---------|------|
| 存储能力没有统一归属 | ✅ | session + message 合并成 SessionStore 一个服务 |
| 模块级函数 + 模块级 db | ✅ | 全部 Effect 化，依赖从 Context 取 |
| 16.2 过渡桥接 | ✅ | 退役删除，没有遗留代码 |

## 对照 opencode

| 我们 | opencode |
|------|----------|
| `SessionStore`（6 个方法） | `core/src/session/store.ts`（get/context/message 等方法） |
| 直接 CRUD（insert/select） | 事件溯源：publish 事件 → projector 写库（阶段 17） |
| 依赖 `DatabaseService` | 依赖 `Database.Service` |

opencode 的 SessionStore 建立在事件溯源之上（每个变更先写成事件再投影到表），
我们目前还是直接 CRUD——阶段 17 会演进。

## 小结

第 6 步做完：
- 存储能力统一归属：SessionStore 一个服务
- 过渡桥接退役，技术债清零
- CLI 入口 Effect 化，全部走服务

## 下一步

[16.7 SystemContext 服务](../07-system-context/01-system-context.md)
——把 system prompt 组装从模块级函数变成服务（阶段 16 最后一个服务）。
