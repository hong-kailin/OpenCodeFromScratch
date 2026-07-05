// src/tool/bash.ts
// bash 工具：执行 shell 命令
// 对照 opencode: packages/opencode/src/tool/shell.ts
// opencode 的 shell 工具支持 PTY、权限检查、流式输出、语法高亮等，我们用最简版

import type { Tool, JSONSchema } from "./tool"
import DESCRIPTION from "./bash.txt"

const parameters: JSONSchema = {
  type: "object",
  properties: {
    command: {
      type: "string",
      description: "要执行的 shell 命令",
    },
  },
  required: ["command"],
}

async function execute(args: Record<string, unknown>): Promise<string> {
  const command = args.command as string

  // 用 Bun.spawn 执行命令
  // 通过 ["sh", "-c", command] 让 shell 解析命令字符串
  // 类比 Python: subprocess.run(command, shell=True)
  const proc = Bun.spawn({
    cmd: ["sh", "-c", command],
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

export const bashTool: Tool = {
  id: "bash",
  description: DESCRIPTION,
  parameters,
  execute,
}
