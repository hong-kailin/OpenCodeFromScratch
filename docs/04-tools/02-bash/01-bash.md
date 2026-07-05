# 4.2 bash：执行 shell 命令

> 本课目标：实现 bash 工具，让 agent 能执行 shell 命令（git、ls、bun 等），捕获输出和退出码。

## bash 工具是什么

read/write/edit 只能操作文件。但 agent 经常需要执行命令——`git status`、`ls`、`bun test`、`npm install` 等。bash 工具让 LLM 能执行任意 shell 命令。

这是**最强大也最危险**的工具——LLM 能执行任何命令，包括删除文件、安装包、推送代码。opencode 的 shell 工具有权限检查（阶段 10 讲），我们先用简化版。

## Bun.spawn：执行命令

Bun 内置了 `Bun.spawn` 来执行子进程命令。类比 Python 的 `subprocess.run`：

```ts
// TS
const result = Bun.spawn({
  cmd: ["echo", "hello"],
  stdout: "pipe",
  stderr: "pipe",
})
const stdout = await new Response(result.stdout).text()
const exitCode = await result.exited
```

```python
# Python 对照
import subprocess
result = subprocess.run(["echo", "hello"], capture_output=True, text=True)
stdout = result.stdout
exitCode = result.returncode
```

### 关键概念

| | 含义 | Python 类比 |
|---|------|-------------|
| `cmd` | 命令数组，如 `["echo", "hello"]` | `subprocess.run(["echo", "hello"])` |
| `stdout: "pipe"` | 捕获标准输出 | `capture_output=True` |
| `stderr: "pipe"` | 捕获标准错误 | `capture_output=True` |
| `result.exited` | 等待进程结束，返回退出码 | `result.returncode` |

### 为什么用数组而不是字符串

`cmd` 是数组 `["echo", "hello"]`，不是字符串 `"echo hello"`。为什么？

- **安全**：数组形式不经过 shell 解析，避免命令注入。`["echo", "hello; rm -rf /"]` 只会打印 "hello; rm -rf /"，不会执行删除
- **准确**：不需要处理引号、空格转义

但 LLM 习惯写 `"echo hello"` 这样的字符串。我们需要把字符串拆成数组——用 `split(" ")` 不够（参数可能含空格），所以用 shell 解析。

> 简化处理：我们把命令字符串传给 `bun -c` 执行，让 shell 解析。

## 实现 bash 工具

### 参数

```ts
{
  type: "object",
  properties: {
    command: { type: "string", description: "要执行的 shell 命令" },
  },
  required: ["command"],
}
```

### execute

```ts
async function execute(args) {
  const command = args.command as string

  // 用 Bun.spawn 执行命令
  // 通过 ["bun", "-c", command] 让 shell 解析命令字符串
  // 类比 Python: subprocess.run(command, shell=True)
  const proc = Bun.spawn({
    cmd: ["sh", "-c", command],
    stdout: "pipe",
    stderr: "pipe",
    cwd: process.cwd(),
  })

  // 捕获 stdout 和 stderr
  const stdout = await new Response(proc.stdout).text()
  const stderr = await new Response(proc.stderr).text()
  const exitCode = await proc.exited

  // 组装输出
  let output = ""
  if (stdout) output += stdout
  if (stderr) output += `\n[stderr]\n${stderr}`
  output += `\n[exit code: ${exitCode}]`

  return output || "[无输出]"
}
```

关键点：

1. **`["sh", "-c", command]`**：让 shell（sh）解析命令字符串。这样 LLM 写 `"ls -la"` 就能正常执行
2. **捕获 stdout + stderr**：两个都要捕获，错误信息在 stderr 里
3. **退出码**：`exitCode` 为 0 表示成功，非 0 表示失败
4. **cwd**：设为当前工作目录，让 `ls`、`git` 等命令在项目目录执行

> 对照 opencode：它的 shell 工具（`tool/shell.ts`）复杂得多——用 Effect 的 `ChildProcess`、支持 PTY（交互式终端）、命令超时、输出流式处理、tree-sitter 语法高亮等。我们用最简版。

## 命令超时

有些命令可能卡住（比如 `npm install` 等网络、交互式命令等）。加个超时：

```ts
const proc = Bun.spawn({
  cmd: ["sh", "-c", command],
  stdout: "pipe",
  stderr: "pipe",
  cwd: process.cwd(),
})

// 超时处理：30 秒后杀掉进程
const timeout = setTimeout(() => proc.kill(), 30000)

const stdout = await new Response(proc.stdout).text()
const stderr = await new Response(proc.stderr).text()
const exitCode = await proc.exited

clearTimeout(timeout)  // 正常结束就取消超时
```

> `proc.kill()` 发送 SIGTERM 信号终止进程。类比 Python 的 `proc.terminate()`。

## 安全考虑

bash 工具让 LLM 能执行**任何命令**——包括 `rm -rf /`、`git push --force` 等。这很危险。

opencode 的做法：
1. **权限系统**：执行命令前弹窗让用户确认（阶段 10 实现）
2. **命令记录**：所有执行的命令都记录到 session 历史
3. **外部目录限制**：防止在工作区外执行操作

我们的简化版暂时不做权限检查——先让功能跑通，阶段 10 再加。

## 注册工具

在 index.ts 加入 bashTool：

```ts
import { bashTool } from "./tool/bash"

const tools: Tool[] = [readTool, writeTool, editTool, bashTool]
```

tool loop 还是不用改——声明式扩展。

## 跑起来

```bash
bun run src/index.ts
```

试试：
- "当前目录有哪些文件？"
- "运行 git status 看看"

## 对照 opencode

| | 我们的 bash | opencode 的 shell |
|---|------------|-------------------|
| 执行方式 | `Bun.spawn(["sh", "-c", cmd])` | Effect ChildProcess + PTY |
| 超时 | 30 秒 kill | 可配置 + 流式超时 |
| 权限 | 无 | `ctx.ask({ permission: "bash" })` |
| 输出 | 全部捕获后返回 | 流式输出 + 截断 + 语法高亮 |
| 交互式 | 不支持 | 支持 PTY（vim、top 等） |

## 本课小结

1. **Bun.spawn**：执行子进程，类比 Python `subprocess.run`
2. **`["sh", "-c", command]`**：让 shell 解析命令字符串
3. **捕获 stdout + stderr + exitCode**：三个都要，错误信息在 stderr
4. **超时处理**：setTimeout + proc.kill，防止命令卡住
5. **安全考虑**：bash 最强大也最危险，opencode 有权限系统（阶段 10）

下一步：[4.3 grep + glob](../03-grep-glob/01-grep-glob.md) —— 搜索工具。
