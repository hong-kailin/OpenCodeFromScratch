# 16.5 第 5 步：Session 存储服务——session + message 服务化

> 对照代码：`packages/core/src/session/store.ts`

## 这一步做什么

把第 1 步搬进来的 `session.ts`（Session CRUD）和 `message.ts`（Message 存储）
合并成一个 SessionStore Service。这是"依赖 Database"的典型例子。

## 之前的问题

两个文件都是模块级函数，直接 import 模块级 db 单例：

```typescript
// session.ts
import { db, sessionTable } from "../database/database"
export async function createSession(title?: string): Promise<Session> { ... }
export async function listSessions(): Promise<Session[]> { ... }

// message.ts
import { db, messageTable } from "../database/database"
export async function saveMessage(sessionId: string, msg: Message): Promise<void> { ... }
```

问题：
1. **职责分散**——session 和 message 是两个文件，但都是"存储"这件事
2. **直接 import db 单例**——无法替换实现（测试时换内存库做不到）
3. **模块级函数**——调用方直接 import 函数，没有"存储"这个概念的边界

## SessionStore Service：三件套

对照 opencode 的 `core/src/session/store.ts`，合并两个模块的职责：

```typescript
// packages/core/src/session/store.ts
import { Context, Effect, Layer } from "effect"
import { eq, desc, asc } from "drizzle-orm"
import { DatabaseService } from "../database/database"
import { sessionTable, messageTable } from "../database/sql"

export interface SessionStoreApi {
  // session CRUD
  readonly create:       (title?: string) => Effect.Effect<Session>
  readonly list:         () => Effect.Effect<Session[]>
  readonly get:          (id: string) => Effect.Effect<Session | undefined>
  readonly update:       (id: string, title: string) => Effect.Effect<void>
  // message 存取
  readonly saveMessage:  (sessionId: string, msg: Message) => Effect.Effect<void>
  readonly loadMessages: (sessionId: string) => Effect.Effect<Message[]>
}

export class SessionStore extends Context.Service<SessionStore, SessionStoreApi>()(
  "opencode-from-scratch/SessionStore",
) {}

export const sessionStoreLayer = Layer.effect(
  SessionStore,
  Effect.gen(function* () {
    // 依赖 Database：从 Context 拿 db（11.3 课学过的"Layer 依赖 Layer"）
    const { db } = yield* DatabaseService

    return SessionStore.of({
      create: Effect.fn("SessionStore.create")(function* (title?: string) {
        // ...
      }),
      list: Effect.fn("SessionStore.list")(function* () {
        // ...
      }),
      // get / update / saveMessage / loadMessages ...
    })
  }),
)
```

**关键点**：`yield* DatabaseService` 展示 Layer 依赖 Layer——
sessionStoreLayer 的 Requirements 是 DatabaseService，组装时必须先 provide Database。

## ⚠️ 一个容易踩的坑：drizzle 的 .all() 是同步的

写 SessionStore 时最容易踩的坑：用 `Effect.promise` 包 drizzle 查询，结果报错。

```typescript
// ❌ 错误：drizzle bun-sqlite 的 .all() 是【同步】的
return yield* Effect.promise(() =>
  db.select().from(sessionTable).all()   // 返回数组，不是 Promise！
)

// error: Property 'then' is missing ... but required in type 'PromiseLike<...>'
```

**为什么**：bun:sqlite 是同步 API，drizzle 包装后 `.all()` / `.get()` 直接返回
结果（不是 Promise）。之前模块级函数 `await db.select()...all()` 能用，是因为
`await` 一个非 Promise 会直接通过。

**正确写法**：用 `Effect.sync` 包同步操作：

```typescript
// ✅ 正确：同步查询用 Effect.sync
return yield* Effect.sync(() =>
  db.select().from(sessionTable).orderBy(desc(sessionTable.time_updated)).all(),
)
```

## 教 debug：运行时 db 为空 / 服务没生效

**场景**：SessionStore 方法执行时 `db` 是 undefined 或报错 "No service found"。

排查思路：
1. **检查 provide 链**：sessionStoreLayer 依赖 DatabaseService，组装时必须
   `sessionStoreLayer.pipe(Layer.provide(databaseLayer))`。如果只 provide 了
   sessionStoreLayer 没 provide Database，取 db 会失败
2. **检查消费方**：`yield* SessionStore` 拿到的是 tag，不是实例。如果直接
   `SessionStore.create()`（没 yield*），拿到的是 undefined
3. **用 fiber trace**：Effect 报错时看 `_stack` 里的服务名，能定位是哪个服务没提供

## 验证：第 5 步成功标志

```bash
bunx tsc --noEmit                              # 通过
bun run packages/opencode/src/index.ts run -c "2+2?"
# 已恢复会话: xxx (N 条历史消息) → 历史加载正常（走 SessionStore 服务）
```

## 工程思维：合并的收益

session 和 message 合并成一个 SessionStore，收益：
1. **一个入口**——"存储"就是 SessionStore，调用方不用知道是两个模块
2. **依赖清晰**——SessionStore 依赖 Database，这个关系写死在类型里
3. **为事件溯源铺垫**——阶段 17 会把 SessionStore 重构成事件溯源
   （publish 事件 → projector 投影），那时一个 SessionStore 服务就是天然的重构点

## 下一步

[16.6 第 6 步：SystemContext 服务](../06-system-context/01-system-context.md)
——组装 system prompt 服务化。
