// src/tool/bash.ts
// bash 工具：执行 shell 命令
// 对照 opencode: packages/opencode/src/tool/shell.ts
// opencode 的 shell 工具支持 PTY、权限检查、流式输出、语法高亮等，我们用最简版
//
// 阶段 13 改动：参数定义从手写 JSON Schema 改为 Effect Schema（单一来源）

import { Schema } from "effect"
import type { Tool } from "./tool"
import DESCRIPTION from "./bash.txt"

export const Parameters = Schema.Struct({
  command: Schema.String.annotate({ description: "要执行的 shell 命令" }),
})

async function execute(args: Schema.Schema.Type<typeof Parameters>): Promise<string> {
  const { command } = args

  // 跨平台 shell 选择
  // 对照 opencode: packages/core/src/shell.ts 的 win() 函数
  //   opencode 在 Windows 上的优先级: pwsh -> powershell -> gitbash -> cmd.exe
  //   我们简化: Windows 用 powershell.exe，Mac/Linux 用 sh
  // process.platform 是 Node/Bun 内置变量，"win32" 代表所有 Windows（含 64 位）
  const isWindows = process.platform === "win32"

  // 用 Bun.spawn 执行命令，让 shell 解析命令字符串
  // Windows: powershell.exe -NoProfile -Command "命令"
  //   -NoProfile  不加载用户 PowerShell 配置文件（加快启动、避免配置干扰）
  //   -Command    执行后面的命令字符串
  // Mac/Linux: sh -c "命令"
  // 类比 Python: subprocess.run(command, shell=True)
  const proc = Bun.spawn({
    cmd: isWindows
      ? ["powershell.exe", "-NoProfile", "-Command", command]
      : ["sh", "-c", command],
    stdout: "pipe",
    stderr: "pipe",
    cwd: process.cwd(),
  })

  // 超时处理：30 秒后杀掉进程（防止卡住）
  const timeout = setTimeout(() => proc.kill(), 30000)

  // 捕获 stdout 和 stderr
  // new Response(stream).text() 把 ReadableStream 读成字符串
  const stdout = await new Response(proc.stdout).text()
  const stderr = await new Response(proc.stderr).text()
  const exitCode = await proc.exited

  clearTimeout(timeout)

  // 组装输出
  let output = ""
  if (stdout) output += stdout
  if (stderr) output += `${output ? "\n" : ""}[stderr]\n${stderr}`
  output += `\n[exit code: ${exitCode}]`

  return output || "[无输出]"
}

export const bashTool: Tool<typeof Parameters> = {
  id: "bash",
  description: DESCRIPTION,
  parameters: Parameters,
  execute,
}
