// src/system-context.ts
// System Context：组装 system prompt
// 对照 opencode: packages/opencode/src/session/system.ts + instruction.ts
// opencode 的 system prompt 有 7 个组件，我们简化为 3 个：角色定义 + 环境信息 + AGENTS.md

import { existsSync, readFileSync } from "fs"
import { join, dirname, resolve } from "path"

// ── 环境信息 ──────────────────────────────────────────────
// 对照 opencode: session/system.ts 的 environment 函数
// opencode 还包含 model name、workspace root、references 等，我们简化为 4 项

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

// ── AGENTS.md 加载 ────────────────────────────────────────
// 对照 opencode: session/instruction.ts 的 systemPaths + system 函数
// opencode 支持 3 层搜索（全局 + 项目 findUp + 配置文件），我们简化为项目 findUp

// 从 startDir 向上逐级查找 AGENTS.md，收集所有找到的文件路径
// 对照 opencode: core/src/fs-util.ts 的 findUp 函数
// opencode 从 cwd 向上到 workspace root，我们简化为从 cwd 到根目录
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
// 对照 opencode: instruction.ts 的 system() 函数
// opencode 在每个文件内容前加 "Instructions from: <path>"，我们也这样做
function loadInstructions(): string {
  const paths = findAgentsMd(process.cwd())
  if (paths.length === 0) return ""

  // 读取每个文件，加上 "Instructions from: <path>" 前缀
  // opencode 按发现顺序（从 cwd 向上）拼接
  const parts: string[] = []
  for (const filePath of paths) {
    const content = readFileSync(filePath, "utf-8")
    if (content.trim()) {
      parts.push(`Instructions from: ${filePath}\n${content}`)
    }
  }

  return parts.join("\n\n")
}

// ── 组装完整 system prompt ────────────────────────────────
// 对照 opencode: session/prompt.ts 里拼接 system 数组的逻辑
// opencode 每次调用都重新组装（日期会变、AGENTS.md 可能改），我们也这样做

export function buildSystemPrompt(): string {
  const role = "你是一个编程助手，用中文回答。你可以使用 read、write、edit、bash、glob、grep 工具读取、写入、编辑文件、执行命令和搜索代码。"
  const env = buildEnvironmentInfo()
  const instructions = loadInstructions()

  // 拼接：角色定义 + 环境信息 + AGENTS.md 指令
  const parts = [role, env]
  if (instructions) {
    parts.push(instructions)
  }

  return parts.join("\n\n")
}
