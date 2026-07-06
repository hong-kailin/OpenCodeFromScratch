# 7.1 环境信息：给 LLM 上下文

> 本课目标：理解 system prompt 的作用，把硬编码的 system prompt 改成动态组装——先加入环境信息（日期、平台、工作目录等）。

## 当前问题

我们的 system prompt 是硬编码的字符串：

```ts
// src/index.ts
const systemPrompt: Message = {
  role: "system",
  content: "你是一个简洁的助手，用中文回答。你可以使用 read、write、edit、bash、glob、grep 工具读取、写入、编辑文件、执行命令和搜索代码。",
}
```

问题是 LLM 不知道：
- 今天几号（不知道日期就可能给过时的信息）
- 在哪个目录运行（不知道工作目录就可能用错路径）
- 什么操作系统（不知道平台就可能给错的命令）
- 是不是 git 仓库（不知道就不敢用 git 命令）

这些信息对 agent 很重要——它要用工具操作文件、执行命令，得知道自己在哪里。

## system prompt 是什么

system prompt 是给 LLM 的**操作手册**——告诉它角色、能力、环境、规则。

```
system prompt（LLM 看的第一条消息）
├── 角色定义：你是一个编程助手
├── 工具说明：你可以用 read、write、bash 等工具
├── 环境信息：工作目录、日期、平台
├── 项目指令：AGENTS.md 里的规则（下一课）
└── 特殊指令：用中文回答、简洁等
```

> 对照 opencode：它的 system prompt 有 7 个组件（base prompt + 环境信息 + AGENTS.md + MCP + skills + structured output + user override）。我们先做 2 个：环境信息 + 角色定义，下一课加 AGENTS.md。

## 环境信息包含什么

对照 opencode 的 `session/system.ts:58-93`：

```ts
// opencode 的环境信息
`You are powered by the model named ${model.api.id}.`
`Here is some useful information about the environment you are running in:`
`<env>`
`  Working directory: ${ctx.directory}`
`  Workspace root folder: ${ctx.worktree}`
`  Is directory a git repo: ${ctx.project.vcs === "git" ? "yes" : "no"}`
`  Platform: ${process.platform}`
`  Today's date: ${new Date().toDateString()}`
`</env>`
```

我们的简化版包含：

| 信息 | 怎么获取 | 为什么需要 |
|------|----------|-----------|
| 工作目录 | `process.cwd()` | LLM 调 read/bash 工具时知道相对路径 |
| 平台 | `process.platform` | macOS 是 `darwin`，Linux 是 `linux`——命令可能不同 |
| 今天日期 | `new Date().toDateString()` | LLM 的训练数据有截止日期，告诉它今天几号 |
| 是否 git 仓库 | 检查 `.git` 目录是否存在 | LLM 知道能不能用 git 命令 |

> `process.cwd()` 类比 Python 的 `os.getcwd()`。`process.platform` 类比 `sys.platform`。

## 实现

创建 `src/system-context.ts`，负责组装 system prompt。

关键设计：
1. **`buildSystemPrompt()` 函数**：返回完整的 system prompt 字符串
2. **角色定义 + 环境信息**：先写角色（你是一个助手），再写环境信息
3. **每次调用重新组装**：日期会变，工作目录可能变——不缓存

> 对照 opencode：它在每次 LLM 调用（每个 loop 迭代）都重新组装 system prompt。这样修改 AGENTS.md 后下一轮就生效。我们也这样做。

## 运行

```bash
bun run src/index.ts
```

改造后行为不变——还是能对话。但 system prompt 里多了环境信息。你可以问 AI "你现在在什么目录" 或 "今天几号" 来验证。

## 调试模式

```bash
DEBUG_INPUTS='["你是什么操作系统？今天几号？你在哪个目录？"]' bun run src/index.ts
```

AI 应该能回答 darwin、今天的日期、工作目录路径——这些信息来自 system prompt 里的环境信息。

## 本课小结

1. **system prompt 是 LLM 的操作手册**：角色、能力、环境、规则
2. **环境信息**：工作目录、平台、日期、git 仓库——LLM 需要知道自己在哪
3. **每次调用重新组装**：日期会变，AGENTS.md 可能改——不缓存
4. **opencode 有 7 个组件**，我们先做 2 个（角色 + 环境），下一课加 AGENTS.md

下一步：[7.2 AGENTS.md 加载](../02-agents-md/) —— 读取项目指令文件。
