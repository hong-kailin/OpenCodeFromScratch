# 16.3 第 3 步：Filesystem 服务——封装文件读写 + glob + grep

> 对照代码：`packages/core/src/filesystem.ts`、
> `packages/core/src/tool/read.ts`（改造后的例子）

## 这一步做什么

把工具里散落的文件操作（Bun.file / Bun.Glob / fs）集中到一个 FileSystem Service。
工具改为从 Context 取服务，不再直接碰 I/O。

## 之前的问题

看 `read` 工具的旧实现（阶段 4-15）：

```typescript
async function execute(args) {
  const file = Bun.file(filePath)   // ← 直接在工具里碰 I/O
  const exists = await file.exists()
  const text = await file.text()
  // ...
}
```

问题：
1. **文件操作散落**——read 用 Bun.file，glob 用 Bun.Glob，grep 又自己写循环，
   每个工具重复实现"跳过 node_modules"等约定
2. **无法 mock**——测试 read 工具必须真读磁盘
3. **约定不统一**——"哪些目录要跳过"没有集中管理

## FileSystem Service：读+写全套

对照 opencode 的 `filesystem.ts`（它有 location/realPath 安全校验等，我们简化），
我们封装工具真正需要的 5 个操作：

```typescript
// packages/core/src/filesystem.ts
import { Context, Effect, Layer } from "effect"

export interface FileSystemApi {
  readonly read:   (filePath: string) => Promise<string | null>  // 读（不存在返回 null）
  readonly exists: (filePath: string) => Promise<boolean>        // 判断存在
  readonly write:  (filePath: string, content: string) => Promise<void>  // 写
  readonly glob:   (pattern: string) => Promise<string[]>        // 匹配文件
  readonly grep:   (pattern: string, include?: string) => Promise<string[]>  // 搜索
}

export class FileSystemService extends Context.Service<FileSystemService, FileSystemApi>()(
  "opencode-from-scratch/FileSystem",
) {}

export const fileSystemLayer = Layer.effect(
  FileSystemService,
  Effect.sync(() =>
    FileSystemService.of({
      read: async (filePath) => {
        const file = Bun.file(filePath)
        if (!(await file.exists())) return null
        return await file.text()
      },
      // exists / write / glob / grep ...
    }),
  ),
)
```

**注意**：方法返回 Promise 而不是 Effect——因为当前工具 execute 还是 `Promise<string>`（阶段 3 起的约定）。16.4 会把工具 Effect 化，到时再决定服务的返回类型。服务的**结构**（三件套）不变，Promise 还是 Effect 只是返回类型的选择。

"跳过 node_modules/opencode" 的约定也收进 glob/grep 里——集中管理。

## 工具改为从 Context 取服务

第 16.4 步会把工具完全 Effect 化。但服务的"消费方从 Context 取"的模式，
用一段最小示例说明：

```typescript
// 在任意 Effect 里
const fs = yield* FileSystemService    // 从 Context 取服务
const text = yield* Effect.promise(() => fs.read(filePath))
```

对比之前：`Bun.file(filePath)` 直接 I/O。
现在：通过服务，测试时可以换一个假 FileSystem 的 Layer。

## 教 debug：工具读不到文件

**场景**：read 工具返回"文件不存在"，但文件明明在。

排查思路：
1. 检查路径是相对还是绝对——工具用 `fs.read(filePath)`，相对路径基于 `process.cwd()`
2. 检查 glob/grep 是否被"跳过 node_modules/opencode" 的过滤误伤——这是服务里的统一约定
3. 如果怀疑服务没生效，用 `console.log` 在 fileSystemLayer 的 read 里打点，确认走的是服务还是旧代码

## 验证：第 3 步成功标志

```bash
bunx tsc --noEmit                              # 通过
bun run packages/opencode/src/index.ts run "读 packages/core/src/debug.ts 第一行"
# read 工具正常返回文件内容（走 FileSystem 服务）
```

## 工程思维：把"碰 I/O"从"业务逻辑"里剥出来

工具的本质是"调用方（LLM）和世界（文件系统）之间的桥"。
桥应该薄——工具只做参数处理 + 格式化输出，真正的 I/O 走服务。

好处：
- **测试**：不用真文件系统，注入假服务即可
- **复用**：read/write/edit 都走同一个 read/write，不会各自实现一遍
- **约定集中**：跳过哪些目录、怎么处理不存在，只有一处

## 下一步

[16.4 第 4 步：Tool 注册表服务化](../04-tool-registry/01-tool-effect.md)
——工具 execute 改 Effect，真正从 Context 取 FileSystem。
