# OpenCode From Scratch 课程大纲

> **活文档**：进入每个阶段前细化具体课程内容，不提前规划过细。核心原则：**每个阶段产出一个能跑的东西**。

## 学习路线图

### 阶段 0：环境与基础（TypeScript + Bun 起步）
- 安装 Bun，理解 .ts 文件直接运行
- TypeScript 基础：类型标注、interface vs type、泛型（对照 Python type hints）
- 项目脚手架：package.json、tsconfig.json、目录结构
- 第一个 console.log 程序

### 阶段 1：最小 Agent（一次 LLM 调用）
- 用 fetch 直接调 OpenAI API（不用任何 SDK）
- 理解 messages 结构、system prompt、role
- 产出：命令行输入一句话，AI 回复一句话（单轮、无工具、无流式）

### 阶段 2：流式输出
- 理解 SSE（Server-Sent Events）流式响应
- 用 Effect Stream 封装流式读取（首次引入 Effect）
- 产出：AI 回复逐字打印到终端

### 阶段 3：工具循环（Agent 的核心）
- 定义 Tool 接口（id、description、parameters、execute）
- 实现第一个工具：read（读文件）
- 实现 tool loop：LLM 返回工具调用 → 执行 → 结果喂回 → 继续
- 理解 max_steps 停止条件
- 产出：AI 能读取本地文件并回答关于文件的问题

### 阶段 4：工具集
- 逐步实现：write、edit、bash、grep、glob、task、todowrite、webfetch
- 每个工具配 .txt 描述文件（LLM 看的工具说明）
- 工具输出截断策略
- 产出：一个能读写文件、执行命令、搜索代码的 agent

### 阶段 5：Session 持久化
- 引入 SQLite + Drizzle ORM
- 设计 session / message / part 表结构
- 对话历史持久化与读取
- 产出：重启程序后能恢复之前的对话

### 阶段 6：Provider 抽象
- 从硬编码 OpenAI 抽象出 Provider 接口
- 接入 Anthropic（Claude）
- 理解 opencode 的 Route 四轴模型（protocol + endpoint + auth + framing）
- 产出：支持多个 LLM provider，可切换

### 阶段 7：System Context & AGENTS.md
- 实现 AGENTS.md 文件加载（项目级 + 全局级）
- 组装 system prompt（日期、环境、工具列表、指令）
- 产出：agent 能读取项目指令并遵守

### 阶段 8：CLI 入口
- 用 yargs 构建 CLI（run、serve 等子命令）
- 对话交互循环（readline）
- 产出：bun run src/index.ts 启动 agent

### 阶段 9：TUI 终端界面（选做）
- 引入 opentui/solid 构建终端 UI
- 消息流渲染、工具调用展示、输入框
- 产出：类 opencode 的终端交互界面

### 阶段 10：高级特性（选做）
- Permission 系统（工具执行前确认）
- MCP（Model Context Protocol）支持
- Subagent（@general 子 agent 调用）
- Compaction（长对话压缩）
- Plugin 系统

---

## 当前状态

- [ ] 阶段 0：环境与基础（TypeScript + Bun 起步）
- [ ] 阶段 1：最小 Agent（一次 LLM 调用）
- [ ] 阶段 2：流式输出
- [ ] 阶段 3：工具循环（Agent 的核心）
- [ ] 阶段 4：工具集
- [ ] 阶段 5：Session 持久化
- [ ] 阶段 6：Provider 抽象
- [ ] 阶段 7：System Context & AGENTS.md
- [ ] 阶段 8：CLI 入口
- [ ] 阶段 9：TUI 终端界面（选做）
- [ ] 阶段 10：高级特性（选做）

> **下一步**：从阶段 0 开始。进入前细化阶段 0 的具体课程内容。
