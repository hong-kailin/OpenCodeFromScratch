# OpenCode From Scratch 课程大纲

> **活文档**：进入每个阶段前细化具体课程内容，不提前规划过细。核心原则：**每个阶段产出一个能跑的东西**。

## 学习路线图

### 阶段 0：环境与基础（TypeScript + Bun 起步）

> **目标**：搭好开发环境，掌握 TypeScript + Bun 的基本开发节奏和调试方法，产出一个能跑的最小程序。
>
> **产出**：`bun run src/index.ts` 打印 "hello opencode"，并理解项目配置文件的作用。

#### 课程

- **0.1 Bun 起步：JS 运行时与包管理器**
  - Bun 是什么：JS 运行时 + 包管理器（类比 Python 解释器 + pip/uv）
  - 安装与验证：`bun --version`
  - .ts 文件直接运行（无需编译步骤，类比 `python script.py`）
  - 第一个程序：`console.log("hello")`（类比 `print()`）
  - 教 debug：运行报错怎么读、`console.log` 打点调试

- **0.2 TypeScript 初步：类型系统（对照 Python type hints）**
  - 声明：本课**不是**完整的 TS 语言教程，只带你建立初步印象。后面章节用到的新 TS 概念/语法会随用随讲
  - 类型标注：`const x: number = 1`（对照 `x: int = 1`）
  - 常用类型：string / number / boolean / array / union（`string | number`）
  - interface vs type：定义对象形状（对照 dataclass / TypedDict）
  - 泛型基础：`function foo<T>(x: T): T`（对照 `def foo[T](x: T) -> T`）
  - 重点：agent 开发会频繁遇到的类型（interface、union、Record、泛型）

- **0.3 模块系统：import 与 export**
  - 为什么需要模块：代码长了要拆文件（对照 Python 的 import）
  - export：导出函数/类型/变量
  - import：导入其他文件的导出
  - 默认导出 vs 命名导出
  - 对照 opencode：看源码里的 import 写法（`@/tool/...` 路径别名预告）

- **0.4 package.json：项目配置与依赖管理**
  - package.json 是什么（对照 pyproject.toml）：name、version、type、scripts
  - `bun install` 安装依赖（对照 `pip install`）
  - dependencies vs devDependencies
  - scripts：自定义命令（`bun run dev`）
  - 从单文件到多文件项目：引入第一个第三方依赖

- **0.5 tsconfig.json：TypeScript 编译配置**
  - tsconfig.json 是什么（对照 mypy.ini 的角色）
  - 为什么需要它：`bun run` 能直接跑 .ts，为什么还要配置
  - extends 继承预设（`@tsconfig/bun`）
  - strict、noEmit、types、paths 路径别名
  - include/exclude：限定检查范围
  - typecheck 命令：`bun run typecheck` / `tsc --noEmit`

- **0.6 VSCode 调试：断点与调试器**
  - 用 VSCode 打开项目，安装 Bun 扩展
  - 设置断点：行号左侧点击（对照 PyCharm/VSCode Python 断点）
  - launch.json 配置：用 Bun 调试 TS 文件
  - 调试面板：变量、调用栈、Watch、Step Over/Into/Out（对照 Python 调试器）
  - 教 debug：条件断点、日志断点（不暂停只打印），什么时候用断点 vs console.log

- **0.7 阶段验收：跑起来 + 工程思维总结**
  - 跑通 `bun run src/index.ts`，输出 "hello opencode"
  - 验收清单：Bun 安装 ✓、TS 运行 ✓、import ✓、package.json ✓、tsconfig ✓、VSCode 调试 ✓
  - 工程思维总结：为什么 opencode 选 Bun？为什么用 TypeScript？
  - 对照 opencode 真实入口：`packages/opencode/src/index.ts`（yargs CLI）

#### 阶段产出

```
opencode-from-scratch/
├── package.json          # 项目配置（依赖、scripts）
├── tsconfig.json         # TS 编译配置
└── src/
    └── index.ts          # 入口：console.log("hello opencode")
```

> monorepo 结构（`packages/` 多 package 分层）等到真正需要拆分抽象时再引入，当前阶段保持单 package 平铺结构。

### 阶段 1：最小 Agent（一次 LLM 调用）

> **目标**：用最原始的 fetch 直接调 OpenAI API，理解 LLM 调用的本质——构建 messages → 发 HTTP 请求 → 解析响应。不用任何 SDK，不用 Effect，不用流式。
>
> **产出**：命令行输入一句话，AI 回复一句话（单轮、无工具、无流式）。

#### 课程

- **1.1 OpenAI API 初探：messages 结构**
  - LLM API 的本质：发 HTTP 请求，拿 JSON 响应（类比调 REST API）
  - messages 数组：role（system/user/assistant）+ content
  - system prompt：给 AI 设定角色和规则
  - 对照 opencode：看 `session/system.ts` 怎么组装 system prompt
  - 用 curl 手动调一次 API，直观感受请求和响应

- **1.2 用 fetch 调 API：async/await 与 Promise**
  - TS 的 fetch（类比 Python 的 requests/httpx）
  - Promise 和 async/await（类比 Python 的 asyncio）
  - 定义消息类型：interface Message { role, content }
  - 构建 messages 数组，发 POST 请求，解析 JSON 响应
  - 教 debug：API 报错怎么读（401 鉴权、429 限流、400 参数错误）

- **1.3 命令行交互：多轮对话**
  - 用 readline 模块读用户输入（类比 Python input()）
  - 维护 messages 历史：每次把 AI 回复加回 messages 数组
  - 循环：用户输入 → 调 API → 打印回复 → 继续
  - 对照 opencode：看 `session/prompt.ts` 的 runLoop 理解 agent loop 雏形

- **1.4 阶段验收：能对话的 agent + 工程思维总结**
  - 跑通多轮对话：输入问题，AI 回答，能连续对话
  - 对照 opencode：我们的 fetch 直调 vs opencode 的 LLM 包抽象（Route 四轴模型）
  - 工程思维：为什么先裸 fetch 再抽象？什么时候该引入 SDK？
  - 预告阶段 2：流式输出（逐字打印而不是等全部生成完）

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

- [x] 阶段 0：环境与基础（TypeScript + Bun 起步）
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

> **下一步**：开始阶段 1 的第 1.1 课「OpenAI API 初探」。
