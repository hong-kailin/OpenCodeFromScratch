# 16.3 FileSystem 服务：把文件操作收口成一个服务

> 阶段 16 的地图见 [16.0 总览](../00-overview/01-overview.md)。
> 本课新建 FileSystem Service，把散在工具里的文件操作收拢。注意：
> 这一步只**定义服务**，工具接入（execute 改 Effect、从 Context 取服务）在 16.4。

## 这一步做什么

新建 `FileSystemService`，把 read / write / edit / glob / grep 工具里散落的
`Bun.file` / `Bun.Glob` 调用收口成 5 个服务方法，让文件操作有统一归属。

对照代码：`packages/core/src/filesystem.ts`、`filesystem-demo.ts`

## 之前的问题

各工具直接碰文件 I/O，有三个毛病：

1. **重复**——`node_modules` / `opencode` 跳过逻辑在 glob.ts 和 grep.ts 各写一遍，
   `Bun.file(...).exists()` 判断在 read / edit / grep 里各写一遍
2. **无法替换**——工具直接调 Bun API，测试想 mock"读文件"必须真读磁盘
3. **约定不统一**——没有一处集中管理"文件操作该怎么搞"

## 解法：FileSystem Service

老规矩，Service 三件套。能力清单（Interface）对齐工具现有的操作：

```typescript
// packages/core/src/filesystem.ts
export interface FileSystemApi {
  readonly read: (filePath: string) => Promise<string | null>  // 不存在返回 null
  readonly exists: (filePath: string) => Promise<boolean>
  readonly write: (filePath: string, content: string) => Promise<void>
  readonly glob: (pattern: string) => Promise<string[]>        // 跳过 node_modules/opencode
  readonly grep: (pattern: string, include?: string) => Promise<string[]>
}

export class FileSystemService extends Context.Service<FileSystemService, FileSystemApi>()(
  "opencode-from-scratch/FileSystem",
) {}

export const fileSystemLayer = Layer.effect(
  FileSystemService,
  Effect.sync(() =>
    FileSystemService.of({
      // 实现就是把原来散在工具里的 Bun 调用搬进来
      read: async (filePath) => {
        const file = Bun.file(filePath)
        if (!(await file.exists())) return null
        return await file.text()
      },
      // ... exists / write / glob / grep 同理
    }),
  ),
)
```

**关键**：`glob` / `grep` 里跳过 `node_modules` / `opencode` 的硬编码，
从工具里抽出来**集中到这里管理**——以后改跳过规则只改一个地方。

## 为什么方法返回 Promise 而不是 Effect

当前工具 execute 是 `(args) => Promise<string>`（阶段 3 起的约定），
Promise 函数体里没有 Context，无法 `yield*`。所以服务方法先对齐 Promise 签名，
等 16.4 工具 Effect 化后再用 `Effect.promise` 桥接。

> 服务三件套的结构和返回类型无关——Promise 还是 Effect 只是方法返回类型的选择，
> Interface / Service / Layer 的骨架不变。

## 消费方怎么用 + 为什么值得（demo）

`filesystem-demo.ts`（跑一下）：

```bash
bun run packages/core/src/filesystem-demo.ts
```

demo 演示了两件事：

**1. 消费方从 Context 取服务**：

```typescript
const demo = Effect.gen(function* () {
  const fs = yield* FileSystemService
  const mdFiles = yield* Effect.promise(() => fs.glob("docs/16-core-services/**/*.md"))
  const text = yield* Effect.promise(() => fs.read(mdFiles[0]!))
  // ...
})

await Effect.runPromise(demo.pipe(Effect.provide(fileSystemLayer)))
```

**2. 服务可替换——换 mock 消费方零改动**（这是最值得看的部分）：

```typescript
// 内存版 mock：glob/read 返回写死的数据
const mockLayer = Layer.effect(FileSystemService, Effect.sync(() =>
  FileSystemService.of({
    read: async () => "mock content",
    glob: async () => ["mock/a.md", "mock/b.md"],
    // ...
  }),
))

// 同一个 demo，只把 provide 的 Layer 换成 mockLayer，消费方代码一行不改
await Effect.runPromise(demo.pipe(Effect.provide(mockLayer)))
```

> 这就是依赖注入的核心价值：**消费方只声明"我需要什么"，不关心实现是谁**。
> 测试时换 mock、线上换真实实现，消费方代码零改动。

## 教 debug

**场景**：mock 替换后报 `FileSystemService 服务未提供` / 取到 undefined。

排查：`demo.pipe(Effect.provide(mockLayer))` 只 provide 了 mockLayer，
但 demo 内部如果 `yield*` 了别的服务（如 FileSystemService 之外），
那个服务没 provide 就会报错。检查 demo 依赖的服务是否都 provide 了。

**场景**：glob 结果比预期少。

排查：服务里跳过了 `node_modules` / `opencode` 开头的路径——这是统一约定，
不是 bug。想查被跳过的目录，临时注释跳过逻辑再跑。

## 验证：这一步成功标志

```bash
bunx tsc --noEmit                            # 通过
bun run packages/core/src/filesystem-demo.ts # 打印真实实现 + mock 实现的输出
bun run packages/opencode/src/index.ts run "2+2?"   # CLI 回归（工具还没接入，应不受影响）
```

## 这一步解决了什么、还没解决什么

| 问题 | 解决了吗 | 说明 |
|------|---------|------|
| 文件操作重复、散落 | ✅ | 收口成 5 个服务方法，统一跳过规则 |
| 无法 mock | ✅ | 消费方 `yield* FileSystemService`，测试换 Layer |
| 工具还没用上它 | ❌ | 工具 execute 还是 Promise，直接调 Bun——16.4 接入 |

> 你可能想问："服务建好了，工具还在直接调 Bun，那不是白建？"
> 不白建。这步先建立"文件操作归属"这个边界，16.4 工具 Effect 化时
> execute 变成 Effect、从 Context 取服务——那时工具就真正走服务了。
> 渐进式的顺序：**先有服务，再接消费者**。

## 对照 opencode

| 我们 | opencode |
|------|----------|
| `FileSystemService`（read/exists/write/glob/grep） | `core/src/filesystem.ts`（read/list/find/glob/grep） |
| 简化：无路径安全检查 | `resolve()` 校验路径不逃逸 location 根目录 |
| 简化：返回字符串 | 返回 `Uint8Array` + mime 类型 |
| glob 用 `Bun.Glob` | 底层 `FileSystemSearch`（fast-glob / ripgrep） |

opencode 的 FileSystem 服务核心是"**路径安全**"（`resolve` 函数校验所有操作
不逃逸项目根目录），我们还用不到，后续阶段再补。

## 小结

第 3 步做完：
- FileSystem 服务成立，5 个文件操作方法有统一归属
- demo 演示了"换 mock 消费方零改动"（依赖注入的价值）
- 工具还没接入——那是 16.4 的事

## 下一步

[16.4 工具 Effect 化](../04-tool-effect/01-tool-effect.md)
——execute 从 `Promise<string>` 变成 `Effect<string>`，工具内部 `yield* FileSystemService`，
真正用上这个服务。
