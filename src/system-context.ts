// src/system-context.ts
// System Context：组装 system prompt
// 对照 opencode: packages/opencode/src/session/system.ts + instruction.ts
// opencode 的 system prompt 有 7 个组件，我们简化为 2 个：角色定义 + 环境信息
// 下一课（7.2）加 AGENTS.md 加载

import { existsSync } from "fs"
import { join } from "path"

// 组装环境信息
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

// 组装完整的 system prompt
// 对照 opencode: session/prompt.ts 里拼接 system 数组的逻辑
// opencode 每次调用都重新组装（日期会变、AGENTS.md 可能改），我们也这样做
export function buildSystemPrompt(): string {
  const role = "你是一个编程助手，用中文回答。你可以使用 read、write、edit、bash、glob、grep 工具读取、写入、编辑文件、执行命令和搜索代码。"
  const env = buildEnvironmentInfo()

  return [role, env].join("\n\n")
}
