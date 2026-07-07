# 8.2 对照 opencode + 阶段验收

> 本课目标：对比我们的 CLI 和 opencode 的 CLI 架构，完成阶段 8 验收。

## opencode 的 CLI 架构

opencode 的 CLI 在 `packages/opencode/src/index.ts`，用 yargs v18 注册了 **23 个命令**：

```
opencode              # 默认启动 TUI（$0 命令）
opencode run          # 运行 agent
opencode serve        # 启动 HTTP 服务器
opencode session list # 列出 session
opencode models       # 列出可用模型
opencode upgrade      # 自更新
opencode db query     # 数据库查询
...                   # 还有 16 个
```

### 命令组织方式

每个命令是独立模块，放在 `src/cli/cmd/` 下：

```
src/cli/cmd/
├── run.ts             # run 命令
├── serve.ts           # serve 命令
├── session.ts         # session 父命令（含 list、delete 子命令）
├── tui.ts             # 默认 TUI 命令（$0）
├── models.ts          # models 命令
├── debug/
│   ├── index.ts       # debug 父命令
│   ├── config.ts      # debug config 子命令
│   ├── lsp.ts         # debug lsp 子命令
│   └── ...            # 还有 11 个 debug 子命令
└── ...
```

### effectCmd：Effect 原生的命令包装器

opencode 不直接用 yargs 的 `command()`，而是包了一层 `effectCmd()`：

```ts
// opencode 的 effectCmd（简化）
export const effectCmd = (opts) => cmd({
  command: opts.command,
  describe: opts.describe,
  builder: opts.builder,
  async handler(args) {
    // 1. 加载项目实例（配置、插件、LSP、文件监听）
    const ctx = await loadInstance(opts.directory(args))
    // 2. 把项目实例提供给 handler
    try {
      await runEffect(opts.handler(args), ctx)
    } finally {
      // 3. 清理资源
      await disposeInstance(ctx)
    }
  },
})
```

为什么包一层？因为 opencode 用 Effect-TS，handler 是 Effect 而不是 async 函数。`effectCmd` 负责：
- 加载项目实例（InstanceContext：配置 + 插件 + LSP）
- 把实例提供给 handler
- handler 执行完后清理资源

> 我们的 agent 不用 Effect-TS，直接用 async handler 就够了。effectCmd 是 Effect-TS 用户的"依赖注入 + 资源管理"工具。

### middleware：全局前置处理

opencode 在 yargs 里加了全局 middleware，所有命令执行前都会跑：

```ts
.middleware(async (opts) => {
  if (opts.printLogs) process.env.OPENCODE_PRINT_LOGS = "1"
  if (opts.logLevel) process.env.OPENCODE_LOG_LEVEL = opts.logLevel
  process.env.AGENT = "1"
  process.env.OPENCODE = "1"
})
```

把 yargs 选项转成环境变量，让深层代码不用传参就能读到。

### `run` 命令的 3 种模式

opencode 的 `run` 命令支持 3 种模式（`src/cli/cmd/run.ts`）：

| 模式 | 触发方式 | 行为 |
|------|----------|------|
| 非交互 | `opencode run "你好"` | 发一条消息，流式输出，退出 |
| 交互本地 | `opencode run --mini` | 启动简化版 TUI，in-process server |
| 交互 attach | `opencode run --mini --attach <url>` | 连接远程 server 交互 |

还有 20+ 个选项：`--model`、`--agent`、`--format`、`--file`、`--auto`、`--thinking`...

## 我们的 CLI

```
opencode-from-scratch run              # 交互模式
opencode-from-scratch run "你好"       # 非交互模式
opencode-from-scratch run -c           # 恢复上次
opencode-from-scratch run -s ses_xxx   # 恢复指定 session
opencode-from-scratch run -d "你好"    # 调试模式
```

1 个命令，4 个选项 + middleware。够用。

## 对比

| | 我们的 | opencode |
|---|--------|----------|
| 命令数 | 1（run） | 23 |
| 选项数 | 4 | 20+ |
| 命令包装 | 直接 yargs handler | effectCmd（Effect + 项目实例管理，后续阶段讲） |
| middleware | 有（--debug → 环境变量） | 有（--print-logs/--log-level → 环境变量） |
| 默认命令 | 无（必须写 run） | `$0`（直接运行启动 TUI） |
| 子命令 | 无 | session list/delete、debug config/lsp/... |
| 非交互模式 | `run "你好"` | 同 |
| 交互模式 | `run`（while + prompt） | `run --mini`（TUI） |

### 什么时候该加更多命令？

现在不需要。我们的 agent 核心是对话，一个 `run` 命令够了。当需要这些功能时再加：

| 需求 | 该加的命令 |
|------|-----------|
| 别人想通过 HTTP 调用 agent | `serve` |
| 查看历史 session | `session list` |
| 删除 session | `session delete` |
| 查看支持哪些模型 | `models` |
| 调试数据库 | `db query` |

> **工程思维**：CLI 命令是"用户界面"——按需添加，不为"完整"而加。opencode 的 23 个命令是长期演化的结果，不是一开始就有的。

## 验收清单

```bash
# 1. 类型检查
bun run typecheck

# 2. 帮助信息
bun run src/index.ts --help
bun run src/index.ts run --help

# 3. 非交互模式
bun run src/index.ts run "1+1等于几"
# AI 回复 "2"，程序退出

# 4. 恢复上次会话
bun run src/index.ts run -c
# 恢复上次的 session，进入交互模式
# 输入 "我刚才问了什么" → AI 能回答

# 5. 指定 session
bun run src/index.ts run -s ses_xxx
# 恢复指定 session

# 6. 交互模式
bun run src/index.ts run
# 列出 session → 选择 → 对话

# 7. 调试模式
DEBUG_INPUTS='["你好"]' bun run src/index.ts run
# VSCode F5 调试

# 8. --debug 选项
bun run src/index.ts run -d "你好"
# middleware 设置 process.env.DEBUG="1"
```

| 验收项 | 状态 |
|--------|------|
| yargs CLI 框架搭建 | ✓ |
| `run` 命令定义 | ✓ |
| `--continue`/`-c` 恢复上次会话 | ✓ |
| `--session`/`-s` 指定恢复 | ✓ |
| `--debug`/`-d` 全局选项 + middleware | ✓ |
| 非交互模式（传 message） | ✓ |
| 交互模式（while 循环） | ✓ |
| `--help` 帮助信息 | ✓ |
| DEBUG_INPUTS 调试兼容 | ✓ |
| typecheck 通过 | ✓ |

## 项目结构

阶段 8 修改的代码：

```
src/
└── index.ts    # 修改：yargs CLI + runToolLoop 提取 + --continue/--session + --debug middleware
```

新增依赖：`yargs` + `@types/yargs`

## 工程思维总结

### 1. CLI 是 agent 的"外壳"

之前的 `src/index.ts` 直接跑对话循环——能跑，但不是"工具"。加了 yargs 后，它变成了一个正式的 CLI 工具：有帮助、有选项、支持非交互模式。

这就是"外壳"的价值——**核心逻辑不变，但用户界面更好**。同样的 agent loop，包一层 CLI 就变成了可 scripting 的工具：

```bash
# 脚本里调用
result=$(bun run src/index.ts run "分析一下这个文件")
echo "$result"
```

> 对比 Python：就像把 `print(input())` 改成 `argparse` + `click`——核心逻辑一样，但变成了好用的命令行工具。

### 2. 非交互模式：agent 作为管道

非交互模式（`run "你好"`）让 agent 可以被其他程序调用——传入消息，拿到回复，退出。这是 agent 作为"管道"而非"应用"的使用方式：

```bash
# agent 读文件 → 结果传给下一个命令
bun run src/index.ts run "读 package.json 里的 version" | grep -o '[0-9.]*'
```

opencode 的 `run` 命令也支持这个模式，还有 `--format json` 输出结构化 JSON。

### 3. 命令拆分：builder 和 handler

yargs 把命令定义拆成 builder（声明参数）和 handler（执行逻辑），这其实是**关注点分离**：
- builder 关心"接受什么参数"——是声明式的
- handler 关心"用参数做什么"——是命令式的

> **算法背景**：这和编译器的设计类似——先 parse（解析输入），再 execute（执行逻辑）。builder 定义 parse 规则，handler 是 execute 逻辑。

## 阶段 8 学了什么

| 课 | 知识点 |
|----|--------|
| 8.1 | yargs 基本用法（process.argv、hideBin、command、builder、handler、positional、option、链式调用）、交互 vs 非交互模式、--continue/--session 选项 |
| 8.2 | 中间件概念（handler 前置处理）、执行顺序（builder→解析→middleware→handler）、横切关注点、选项转环境变量、global 选项 |
| 8.3 | opencode 23 命令架构、effectCmd 包装器（Effect-TS 后续阶段讲）、middleware 对比、run 的 3 种模式、CLI 作为"外壳" |

你现在是"正式 CLI 工具"——有命令、有选项、有帮助、支持非交互。核心 agent loop 已经完整：能对话、能用工具、能持久化、能读项目指令、能命令行调用。

---

下一步：[阶段 9：TUI 终端界面（选做）](../../09-tui/) —— 或跳到 [阶段 10：高级特性](../../10-advanced/)。
