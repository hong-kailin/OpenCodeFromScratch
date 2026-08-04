# 4.2 bash：执行 shell 命令

> 本课目标：实现 bash 工具，让 agent 能执行 shell 命令（git、dir、bun 等），捕获输出和退出码。

## bash 工具是什么

read/write/edit 只能操作文件。但 agent 经常需要执行命令--`git status`、`dir`、`bun test`、`npm install` 等。bash 工具让 LLM 能执行任意 shell 命令。

这是**最强大也最危险**的工具--LLM 能执行任何命令，包括删除文件、安装包、推送代码。opencode 的 shell 工具有权限检查（阶段 10 讲），我们先用简化版。

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

但 LLM 习惯写 `"echo hello"` 这样的字符串。我们需要把字符串拆成数组--用 `split(" ")` 不够（参数可能含空格），所以用 shell 解析。

> 简化处理：我们把命令字符串传给 shell 执行，让 shell 解析。

## 跨平台：Windows 和 Mac/Linux 的 shell 不同

这里有一个真实的问题：Mac/Linux 自带 `sh`，但 **Windows 没有 `sh`**。直接写 `["sh", "-c", command]` 在 Windows 上会报错。

opencode 怎么解决的？看 `packages/core/src/shell.ts`：

```ts
// opencode 的做法（简化）
function win() {
  // Windows 上按优先级找 shell: pwsh -> powershell -> gitbash -> cmd.exe
  return [which("pwsh"), which("powershell"), gitbash(), process.env.COMSPEC || "cmd.exe"]
    .filter(Boolean)
}

// 不同 shell 用不同的参数格式
function args(file, command, cwd) {
  if (name(file) === "cmd") return ["/c", command]           // cmd.exe
  if (ps(file)) return ["-NoProfile", "-Command", command]   // PowerShell
  return ["-c", command]                                      // sh/bash
}
```

opencode 通过 `process.platform === "win32"` 判断平台，然后选择合适的 shell。

> **`process.platform`** 是 Node/Bun 内置变量：
> - Windows（含 64 位）-> `"win32"`（不是 32 位的意思，是历史遗留命名）
> - Mac -> `"darwin"`
> - Linux -> `"linux"`

我们的简化方案：

| 平台 | shell | 参数 | 完整命令 |
|------|-------|------|---------|
| Windows | `powershell.exe` | `-NoProfile -Command` | `powershell.exe -NoProfile -Command "git status"` |
| Mac/Linux | `sh` | `-c` | `sh -c "git status"` |

PowerShell 的 `-NoProfile` 参数：不加载用户的 PowerShell 配置文件，加快启动速度、避免配置干扰。opencode 的 `shell.ts` 也是这么用的。

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
// 跨平台 shell 选择
// 对照 opencode: packages/core/src/shell.ts 的 win() 函数
const isWindows = process.platform === "win32"

async function execute(args) {
  const command = args.command as string

  // Windows: powershell.exe -NoProfile -Command "命令"
  // Mac/Linux: sh -c "命令"
  const proc = Bun.spawn({
    cmd: isWindows
      ? ["powershell.exe", "-NoProfile", "-Command", command]
      : ["sh", "-c", command],
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

1. **`process.platform === "win32"`**：判断是否 Windows，选择对应的 shell
2. **PowerShell vs sh 参数**：PowerShell 用 `-NoProfile -Command`，sh 用 `-c`，都是让 shell 解析命令字符串
3. **捕获 stdout + stderr**：两个都要捕获，错误信息在 stderr 里
4. **退出码**：`exitCode` 为 0 表示成功，非 0 表示失败
5. **cwd**：设为当前工作目录，让 `dir`、`git` 等命令在项目目录执行

> 对照 opencode：它的 shell 工具（`tool/shell.ts`）复杂得多--用 Effect 的 `ChildProcess`、支持 PTY（交互式终端）、命令超时、输出流式处理、tree-sitter 语法高亮等。我们用最简版。

## 命令超时

有些命令可能卡住（比如 `npm install` 等网络、交互式命令等）。加个超时：

```ts
const proc = Bun.spawn({
  cmd: isWindows
    ? ["powershell.exe", "-NoProfile", "-Command", command]
    : ["sh", "-c", command],
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

> `proc.kill()` 终止进程。Windows 和 Mac/Linux 底层实现不同，但 Bun 统一了接口。
> opencode 在 Windows 上用 `taskkill /pid /f /t` 杀进程树（见 `shell.ts` 的 `killTree`），更彻底。

## 安全考虑

bash 工具让 LLM 能执行**任何命令**--包括 `rm -rf /`、`git push --force`、`del /s /q` 等。这很危险。

opencode 的做法：
1. **权限系统**：执行命令前弹窗让用户确认（阶段 10 实现）
2. **命令记录**：所有执行的命令都记录到 session 历史
3. **外部目录限制**：防止在工作区外执行操作

我们的简化版暂时不做权限检查--先让功能跑通，阶段 10 再加。

## 注册工具

在 index.ts 加入 bashTool：

```ts
import { bashTool } from "./tool/bash"

const tools: Tool[] = [readTool, writeTool, editTool, bashTool]
```

tool loop 还是不用改--声明式扩展。

## 跑起来

```bash
bun run src/index.ts
```

试试：
- "当前目录有哪些文件？"（Windows 会执行 `dir` 或 `Get-ChildItem`，Mac 会执行 `ls`）
- "运行 git status 看看"

## 对照 opencode

| | 我们的 bash | opencode 的 shell |
|---|------------|-------------------|
| 跨平台 | `process.platform` 判断，Win 用 PowerShell / Mac 用 sh | 自动探测 pwsh/powershell/gitbash/cmd |
| 执行方式 | `Bun.spawn([shell, ...args, cmd])` | Effect ChildProcess + PTY |
| 超时 | 30 秒 kill | 可配置 + 流式超时 |
| 权限 | 无 | `ctx.ask({ permission: "bash" })` |
| 输出 | 全部捕获后返回 | 流式输出 + 截断 + 语法高亮 |
| 交互式 | 不支持 | 支持 PTY（vim、top 等） |

## 本课小结

1. **Bun.spawn**：执行子进程，类比 Python `subprocess.run`
2. **跨平台 shell**：用 `process.platform === "win32"` 判断，Windows 用 PowerShell、Mac/Linux 用 sh
3. **捕获 stdout + stderr + exitCode**：三个都要，错误信息在 stderr
4. **超时处理**：setTimeout + proc.kill，防止命令卡住
5. **安全考虑**：bash 最强大也最危险，opencode 有权限系统（阶段 10）

下一步：[4.3 grep + glob](../03-grep-glob/01-grep-glob.md) -- 搜索工具。
