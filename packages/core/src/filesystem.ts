// packages/core/src/filesystem.ts
// 阶段 16.3 教学代码：FileSystem Service——封装文件读写 + glob + grep
//
// 解决的问题（为什么需要这个服务）：
//   之前（阶段 4-15）：read/write/edit/glob/grep 工具各自直接调 Bun.file / Bun.Glob / fs
//   问题：
//   1. 文件操作逻辑散落在各个工具里，重复且无法复用
//   2. 工具直接碰 I/O，测试时无法替换（想测"读文件"逻辑必须真读磁盘）
//   3. 没有统一的地方做"文件操作约定"（如跳过 node_modules）
//   现在：文件操作集中到 FileSystem Service，工具从 Context 取用，可替换实现
//
// 对照 opencode: packages/core/src/filesystem.ts
//   opencode 的 FileSystem 服务有 read/list/find/glob/grep + location/realPath 安全校验
//   我们简化：只封装当前工具需要的 read/exists/write/glob/grep（读+写全套）
//   安全校验（Path escapes）后续阶段再加
//
// 为什么方法返回 Promise 而不是 Effect？
//   当前工具 execute 是 `(args) => Promise<string>`（阶段 3 起的约定）。
//   16.3 先让服务方法对齐这个签名（Promise），16.4 工具改造时再决定是否整体 Effect 化。
//   服务三件套结构不变——Promise 还是 Effect 只是返回类型的选择。

import { Context, Effect, Layer } from "effect"

// ── 1. Interface：声明能力 ─────────────────────────────────
// 文件系统相关的 5 个操作，全部返回 Promise（对齐工具 execute 的签名）
export interface FileSystemApi {
  // 读文件文本。文件不存在返回 null（调用方自己决定怎么处理）
  readonly read: (filePath: string) => Promise<string | null>
  // 判断文件是否存在
  readonly exists: (filePath: string) => Promise<boolean>
  // 写文件（不存在则创建，存在则覆盖）
  readonly write: (filePath: string, content: string) => Promise<void>
  // glob 匹配文件列表（跳过 node_modules/opencode，和工具原行为一致）
  readonly glob: (pattern: string) => Promise<string[]>
  // grep 正则搜索文件内容（返回 "path:line: 内容" 列表）
  readonly grep: (pattern: string, include?: string) => Promise<string[]>
}

// ── 2. Service：tag ────────────────────────────────────────
export class FileSystemService extends Context.Service<FileSystemService, FileSystemApi>()(
  "opencode-from-scratch/FileSystem",
) {}

// ── 3. fileSystemLayer：提供实现 ───────────────────────────
// 具体实现：用 Bun 的 API（Bun.file / Bun.Glob）+ fs
// 这个 Layer 可以替换——测试时换成一个"内存版"或"记录调用的假实现"
export const fileSystemLayer = Layer.effect(
  FileSystemService,
  Effect.sync(() =>
    FileSystemService.of({
      // 读文件：Bun.file().text()，文件不存在返回 null
      read: async (filePath) => {
        const file = Bun.file(filePath)
        if (!(await file.exists())) return null
        return await file.text()
      },

      // 判断存在
      exists: async (filePath) => {
        return await Bun.file(filePath).exists()
      },

      // 写文件：Bun.write（不存在创建，存在覆盖）
      write: async (filePath, content) => {
        await Bun.write(filePath, content)
      },

      // glob 匹配：Bun.Glob 递归扫描当前目录
      // 跳过 node_modules 和 opencode（原工具里的硬编码，集中到这里管理）
      glob: async (pattern) => {
        const glob = new Bun.Glob(pattern)
        const paths: string[] = []
        for await (const p of glob.scan(".")) {
          if (p.startsWith("node_modules") || p.startsWith("opencode")) continue
          paths.push(p)
        }
        return paths
      },

      // grep 搜索：glob 找文件 → 读内容 → 逐行正则匹配
      // 输出格式和 ripgrep 一致："path:line: 内容"
      grep: async (pattern, include) => {
        const regex = new RegExp(pattern, "i")
        const results: string[] = []
        const glob = new Bun.Glob(include || "**/*")
        for await (const filePath of glob.scan(".")) {
          if (filePath.startsWith("node_modules") || filePath.startsWith("opencode")) continue
          const file = Bun.file(filePath)
          if (!(await file.exists())) continue
          const text = await file.text()
          const lines = text.split("\n")
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i]
            if (line && regex.test(line)) {
              results.push(`${filePath}:${i + 1}: ${line.trim()}`)
            }
          }
        }
        return results
      },
    }),
  ),
)
