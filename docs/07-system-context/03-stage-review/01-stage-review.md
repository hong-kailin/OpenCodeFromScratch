# 7.3 对照 opencode + 阶段验收

> 本课目标：对比我们的 system context 和 opencode 的完整管线，完成阶段 7 验收。

## opencode 的 system prompt 管线

opencode 的 system prompt 有 **7 个组件**，每次 LLM 调用都重新组装：

| # | 组件 | 来源 | 作用 |
|---|------|------|------|
| 1 | Base prompt | agent 定义或 model 特定的 `.txt` 文件 | 角色定义（build agent、plan agent 等不同角色） |
| 2 | 环境信息 | `sys.environment(model)` | 工作目录、平台、日期、git、model name |
| 3 | AGENTS.md 指令 | `instruction.system()` | findUp 搜索 + 全局 + 配置文件 |
| 4 | MCP 指令 | `sys.mcp(agent, permission)` | MCP server 提供的工具说明 |
| 5 | Skills | `sys.skills(agent)` | 可用 skill 的详细描述 |
| 6 | Structured output | 常量 | JSON schema 输出时的额外指令 |
| 7 | User override | API 调用者传入的 system | 每次调用可以临时覆盖 |

最终拼成一个字符串，作为 `role: "system"` 消息发给 LLM。

## 我们的 system prompt

我们只有 **3 个组件**：

| # | 组件 | 来源 |
|---|------|------|
| 1 | 角色定义 | 硬编码字符串 |
| 2 | 环境信息 | `buildEnvironmentInfo()` |
| 3 | AGENTS.md | `findAgentsMd()` + `loadInstructions()` |

## 对比

| | 我们的 | opencode 的 | 什么时候补 |
|---|--------|-------------|-----------|
| 角色定义 | 一个字符串 | 多个 agent（build/plan/general） | 阶段 10（subagent） |
| 环境信息 | 4 项（cwd/platform/date/git） | 7+ 项（含 model name、workspace、references） | 需要时补 |
| AGENTS.md | findUp 从 cwd 到根 | findUp + 全局 + CLAUDE.md + 配置 URL | 需要时补 |
| MCP | 无 | MCP server 指令 | 阶段 10（MCP） |
| Skills | 无 | skill 详细描述 | 阶段 10（skills） |
| Structured output | 无 | JSON schema 输出指令 | 不需要（我们不做结构化输出） |
| User override | 无 | 每次调用可临时覆盖 | 不需要 |

> **工程思维**：3 个组件够用就先 3 个。MCP、skills 这些是 opencode 的高级功能，我们到阶段 10 再加。先跑起来，痛了再补。

## 组装时机

### opencode：每次 LLM 调用都重新组装

```ts
// opencode 的 runLoop（简化）
while (true) {
  // 每轮都重新读 AGENTS.md、重新算日期
  const [env, instructions, ...] = yield* Effect.all([...])
  const system = [...env, ...instructions, ...]
  // 用新的 system 调 LLM
  yield* handle.process({ system, ... })
}
```

好处：**修改 AGENTS.md 后下一轮就生效**，不用重启。
代价：每轮都读文件（IO 开销）。

### 我们：启动时读一次

```ts
// 我们的 index.ts
const systemPrompt = buildSystemPrompt()  // 启动时读一次
while (true) {
  // 用同一个 systemPrompt
}
```

好处：简单，不重复读文件。
代价：修改 AGENTS.md 要重启才生效。

### 要不要改成每轮读？

目前不需要。我们的 agent 不是长期运行的 server——用户启动、对话、退出。下次启动自然读到新的 AGENTS.md。

如果后续做成 server 模式（阶段 8 的 CLI 入口），可以考虑每轮重新组装。opencode 这么做是因为它的 session 可能运行很久（几小时甚至几天），中途用户可能修改 AGENTS.md。

## 验收清单

```bash
# 1. 类型检查通过
bun run typecheck

# 2. 环境信息生效
DEBUG_INPUTS='["你是什么操作系统？今天几号？"]' bun run src/index.ts
# AI 应该能回答 darwin、今天的日期

# 3. AGENTS.md 生效
DEBUG_INPUTS='["这个项目用了什么技术栈？简短回答"]' bun run src/index.ts
# AI 应该能回答 Bun、TypeScript、Effect-TS 等

# 4. 正常对话
bun run src/index.ts
# 启动 → 新建/恢复 session → 对话 → 工具调用
```

| 验收项 | 状态 |
|--------|------|
| 环境信息组装（日期/平台/目录/git） | ✓ |
| AGENTS.md findUp 搜索 | ✓ |
| AGENTS.md 内容拼入 system prompt | ✓ |
| system prompt 动态组装（不再硬编码） | ✓ |
| typecheck 通过 | ✓ |
| AI 能读取环境信息 | ✓ |
| AI 能读取 AGENTS.md | ✓ |

## 项目结构

阶段 7 新增/修改的代码：

```
src/
├── index.ts              # 修改：用 buildSystemPrompt() 替换硬编码
└── system-context.ts     # 新增：环境信息 + AGENTS.md 加载 + system prompt 组装
```

## 工程思维总结

### 1. system prompt 是 agent 的"操作手册"

之前的 system prompt 只有一句"你是一个助手"。加了环境信息和 AGENTS.md 后，AI 突然"知道"了自己在哪里、用什么技术栈、该遵守什么规则。

这就是 system prompt 的价值——**它定义了 agent 的行为边界**。同样的 LLM，不同的 system prompt，表现完全不同。

> 对比 Python：就像给一个人不同的 job description——同样的能力，不同的指令产生不同的行为。

### 2. 上下文注入 vs 硬编码

我们没有把环境信息写死在代码里，而是**运行时动态获取**（`process.cwd()`、`new Date()`、`existsSync`）。这样：
- 换一台机器 → 自动适配（platform 变了）
- 换一天 → 自动更新（date 变了）
- 换一个项目 → 自动读取不同的 AGENTS.md

这是"数据驱动"的思维——**代码是逻辑，数据是配置**。AGENTS.md 是配置，代码读配置而不是写死配置。

### 3. findUp：多层级配置

findUp 搜索是一个常见的配置模式——从当前目录向上找，收集所有层级的配置文件。很多工具都用这个模式：
- Git：从当前目录向上找 `.gitconfig`
- ESLint：从当前目录向上找 `.eslintrc`
- TypeScript：从当前目录向上找 `tsconfig.json`

> **算法背景**：findUp 本质是树的向上遍历。时间复杂度 O(depth)，depth 是目录层级深度。

## 阶段 7 学了什么

| 课 | 知识点 |
|----|--------|
| 7.1 | system prompt 的作用、环境信息（cwd/platform/date/git）、动态组装 |
| 7.2 | AGENTS.md 文件加载、findUp 搜索、多层级配置拼接 |
| 7.3 | opencode 7 组件管线、组装时机（每轮 vs 一次）、上下文注入 vs 硬编码 |

你现在是"懂项目规则的 agent"——AI 知道自己在哪、用什么技术栈、该遵守什么约定。下一步是构建正式的 CLI 入口。

---

下一步：[阶段 8：CLI 入口](../../08-cli/) —— 用 yargs 构建 CLI，正式的命令行入口。
