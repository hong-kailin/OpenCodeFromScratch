// packages/core/src/filesystem-demo.ts
// 阶段 16.3 教学代码：FileSystem Service 演示
// 跑法：bun run packages/core/src/filesystem-demo.ts
//
// 演示两件事：
//   1. 消费方从 Context 取 FileSystemService，调用 read/glob/grep 等服务方法
//   2. 服务可替换——测试时换一个"假实现"，消费方代码不用改（依赖注入的价值）
//
// 对比：之前 read 工具直接 Bun.file(...)（散在工具里、无法替换）；
//       现在文件操作收口成服务，谁需要谁 yield* FileSystemService。

import { Context, Effect, Layer } from "effect"
import { FileSystemService, fileSystemLayer } from "./filesystem"

// 一个消费方 Effect：只声明"我需要 FileSystemService"，不关心底层是真文件系统
// 还是 mock。它做的事：glob 找 md 文件 + read 读其中一个。
const demo = Effect.gen(function* () {
  // yield* FileSystemService：从 Context 取服务实例
  const fs = yield* FileSystemService

  // 1. 用 glob 找 docs 下的课程文档
  const mdFiles = yield* Effect.promise(() => fs.glob("docs/16-core-services/**/*.md"))
  console.log(`glob 找到 ${mdFiles.length} 个课程文档`)

  // 2. 用 read 读第一个文件的前 5 行
  const first = mdFiles[0]
  if (first) {
    const text = yield* Effect.promise(() => fs.read(first))
    const head = text?.split("\n").slice(0, 5).join("\n")
    console.log(`\n第一个文件 ${first} 前 5 行：\n${head}`)
  }

  // 3. 用 exists 判断一个文件是否存在
  const exists = yield* Effect.promise(() => fs.exists("package.json"))
  console.log(`\npackage.json 存在：${exists}`)

  return mdFiles.length
})

// 跑起来：provide 真实实现
const count = await Effect.runPromise(demo.pipe(Effect.provide(fileSystemLayer)))
console.log(`\n（真实实现）共 ${count} 个文档`)

// ── 服务可替换：换一个"假实现"，消费方代码零改动 ──────────────
// 定义内存版 mock：glob 返回写死的列表，read 返回写死的内容。
// 除了 Layer 换掉，demo（消费方）一行不改——这就是"依赖注入"。
const mockLayer = Layer.effect(
  FileSystemService,
  Effect.sync(() =>
    FileSystemService.of({
      read: async () => "mock content",
      exists: async () => true,
      write: async () => {},
      glob: async () => ["mock/a.md", "mock/b.md"],
      grep: async () => ["mock/a.md:1: mock"],
    }),
  ),
)

const mockCount = await Effect.runPromise(demo.pipe(Effect.provide(mockLayer)))
console.log(`\n（mock 实现）共 ${mockCount} 个文档——同一个消费方，换实现不用改代码`)
