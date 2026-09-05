// packages/core/src/system-context.ts
// 阶段 16.6 教学代码：SystemContext Service——组装 system prompt
//
// 之前（阶段 7-15）：system-context.ts 是模块级函数
//   import { buildSystemPrompt } from "./system-context"
//   index.ts / tui/agent.tsx 每次直接调用模块级函数
//   问题：
//   1. 组装逻辑（角色+环境+AGENTS.md）散在模块级，无法替换实现
//   2. 无法 mock——测试时要控制"环境信息"或"AGENTS.md"很麻烦
//
// 现在（阶段 16.6）：SystemContext Service（三件套）
//   1. Interface       -- 声明能力：build() 返回完整 system prompt
//   2. Service         -- tag
//   3. systemContextLayer -- 提供实现
//
// 对照 opencode: packages/core/src/system-context/
//   opencode 用 registry 模式（SystemContextRegistry：register + load，
//   多个组件注册后合并加载，详见 registry.ts）。我们简化成单个 Service，
//   后续阶段（17+）如果系统提示组件变多，再演进成 registry 模式。

import { Context, Effect, Layer } from "effect"
import { existsSync, readFileSync } from "fs"
import { join, dirname, resolve } from "path"

// ── 1. Interface：声明能力 ─────────────────────────────────
// 只有一个能力：build()，返回完整的 system prompt 字符串
export interface SystemContextApi {
  readonly build: () => Effect.Effect<string>
}

// ── 2. Service：tag ────────────────────────────────────────
export class SystemContext extends Context.Service<SystemContext, SystemContextApi>()(
  "opencode-from-scratch/SystemContext",
) {}

// ── 内部工具函数（不导出）──────────────────────────────────

// 环境信息：给 LLM 的当前环境上下文
// 对照 opencode: session/system.ts 的 environment 函数
function buildEnvironmentInfo(): string {
  const cwd = process.cwd()
  const platform = process.platform
  const date = new Date().toDateString()
  const isGitRepo = existsSync(join(cwd, ".git"))

  return [
    "Here is some useful information about the environment you are running in:",
    "<env>",
    `  Working directory: ${cwd}`,
    `  Platform: ${platform}`,
    `  Today's date: ${date}`,
    `  Is directory a git repo: ${isGitRepo ? "yes" : "no"}`,
    "</env>",
  ].join("\n")
}

// 从 startDir 向上逐级查找 AGENTS.md，收集所有找到的文件路径
// 对照 opencode: core/src/fs-util.ts 的 findUp 函数
function findAgentsMd(startDir: string): string[] {
  const results: string[] = []
  let current = startDir
  while (true) {
    const filePath = join(current, "AGENTS.md")
    if (existsSync(filePath)) {
      results.push(resolve(filePath))
    }
    const parent = dirname(current)
    if (parent === current) break // 到达文件系统根目录
    current = parent
  }
  return results
}

// 加载所有 AGENTS.md 文件，拼接成一段指令字符串
function loadInstructions(): string {
  const paths = findAgentsMd(process.cwd())
  if (paths.length === 0) return ""

  const parts: string[] = []
  for (const filePath of paths) {
    const content = readFileSync(filePath, "utf-8")
    if (content.trim()) {
      parts.push(`Instructions from: ${filePath}\n${content}`)
    }
  }

  return parts.join("\n\n")
}

// ── 3. systemContextLayer：提供实现 ────────────────────────
// build() 每次调用都重新组装（日期会变、AGENTS.md 可能改）
// 文件读写是同步的（readFileSync），用 Effect.sync 包
export const systemContextLayer = Layer.effect(
  SystemContext,
  Effect.sync(() =>
    SystemContext.of({
      build: Effect.fn("SystemContext.build")(function* () {
        const role = "你是一个编程助手，用中文回答。你可以使用 read、write、edit、bash、glob、grep 工具读取、写入、编辑文件、执行命令和搜索代码。"
        const env = buildEnvironmentInfo()
        const instructions = loadInstructions()

        // 拼接：角色定义 + 环境信息 + AGENTS.md 指令
        const parts = [role, env]
        if (instructions) {
          parts.push(instructions)
        }

        return parts.join("\n\n")
      }),
    }),
  ),
)

