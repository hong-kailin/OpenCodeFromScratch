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

> **目标**：模仿 opencode 的配置文件模式，读取 JSON 配置获取 baseURL/apiKey/model，用 fetch 调 OpenAI 兼容 API。理解 LLM 调用的本质——读配置 → 构建 messages → 发 HTTP 请求 → 解析响应。不用任何 SDK，不用 Effect，不用流式。
>
> **产出**：命令行输入一句话，AI 回复一句话（单轮、无工具、无流式），provider 信息从配置文件读取。

#### 课程

- **1.1 配置文件模式：像 opencode 一样管理 provider**
  - opencode 的配置模式：`opencode.json` 里写 provider（baseURL/apiKey/models）
  - `model: "provider/model"` 格式：providerID 和 modelID 的拆分
  - 对照 opencode：看 `config/config.ts` 怎么加载配置、`provider/provider.ts` 怎么解析
  - 设计我们的配置文件 `opencode.json`：provider + model + messages 结构

- **1.2 messages 结构与 curl 实操**
  - LLM API 的本质：发 HTTP 请求，拿 JSON 响应（类比调 REST API）
  - messages 数组：role（system/user/assistant）+ content
  - system prompt：给 AI 设定角色和规则
  - 对照 opencode：看 `session/system.ts` 怎么组装 system prompt
  - 用 curl 手动调一次 API（用配置文件里的 baseURL/apiKey），直观感受请求和响应

- **1.3 用 fetch 调 API：async/await 与 Promise**
  - TS 的 fetch（类比 Python 的 requests/httpx）
  - Promise 和 async/await（类比 Python 的 asyncio）
  - 读配置文件 → 解析 provider/model → 构建 messages → 发 POST 请求 → 解析响应
  - 教 debug：API 报错怎么读（401 鉴权、429 限流、400 参数错误）

- **1.4 命令行交互：多轮对话**
  - 用 readline 模块读用户输入（类比 Python input()）
  - 维护 messages 历史：每次把 AI 回复加回 messages 数组
  - 循环：用户输入 → 调 API → 打印回复 → 继续
  - 对照 opencode：看 `session/prompt.ts` 的 runLoop 理解 agent loop 雏形

- **1.5 阶段验收：能对话的 agent + 工程思维总结**
  - 跑通多轮对话：输入问题，AI 回答，能连续对话
  - 对照 opencode：我们的 fetch 直调 vs opencode 的 LLM 包抽象（Route 四轴模型）
  - 工程思维：为什么先裸 fetch 再抽象？什么时候该引入 SDK？
  - 预告阶段 2：流式输出（逐字打印而不是等全部生成完）

### 阶段 2：流式输出

> **目标**：把"等全部生成完再打印"改成"逐字打印"，理解 SSE 流式响应和 TS 的流式读取。
>
> **产出**：AI 回复逐字打印到终端，像打字机一样。

#### 课程

- **2.1 流式输出是什么：SSE 格式**
  - 非流式 vs 流式的区别：等全部生成 vs 逐字返回
  - 请求加 `stream: true`，响应变成 SSE 格式（`data: {JSON}\n\n`）
  - 用 curl `--no-buffer` 手动调一次流式 API，看逐块返回
  - 对照 opencode：它始终用 `stream: true`，不走非流式

- **2.2 用 fetch 读流式响应：ReadableStream**
  - fetch 返回的 response.body 是 ReadableStream（流式读取）
  - 用 async iterator 逐块读取（`for await (const chunk of response.body)`）
  - 解析 SSE：按 `data: ` 前缀提取 JSON，遇到 `[DONE]` 结束
  - 提取 `choices[0].delta.content` 拿到文本增量
  - 教 debug：流式读取卡住、乱码等常见问题

- **2.3 封装流式 chat 函数 + 集成到多轮对话**
  - 把流式读取封装成 `chatStream()` 函数
  - 逐字打印到终端（process.stdout.write 不换行）
  - 收集完整文本加入 messages 历史
  - 替换阶段 1 的 `chat()` 为流式版本

- **2.4 阶段验收：打字机效果 + 工程思维总结**
  - 跑通：AI 回复逐字打印
  - 对照 opencode：我们的 ReadableStream vs opencode 的 Effect Stream
  - 工程思维：为什么 opencode 始终用流式？流式带来的复杂度
  - 预告阶段 3：工具循环（agent 的核心）

### 阶段 3：工具循环（Agent 的核心）

> **目标**：让 LLM 能调用工具——实现 read 工具，LLM 返回工具调用时执行工具、把结果喂回、继续循环，直到 LLM 不再调用工具。
>
> **产出**：问 AI"src/index.ts 里写了什么"，AI 自动调用 read 工具读文件，回答文件内容。

#### 课程

- **3.1 Tool Calling 是什么：LLM 怎么调用工具**
  - LLM 本身不能读文件/执行命令，但它能"告诉你"要做什么
  - OpenAI API 的 function calling：请求加 `tools` 字段，响应返回 `tool_calls`
  - tool_calls 格式：`{id, function: {name, arguments}}`
  - tool 结果以 `role: "tool"` 消息喂回
  - 用 curl 手动调一次带 tools 的请求，看 LLM 怎么返回 tool_calls
  - 对照 opencode：看 `tool/tool.ts` 的 Def 接口

- **3.2 定义 Tool 接口 + 实现 read 工具**
  - 定义我们的 Tool 接口：`{id, description, parameters, execute}`
  - 实现 read 工具：读文件，返回带行号的文本
  - 工具描述：LLM 看的说明文本
  - 对照 opencode：看 `tool/read.ts` 和 `tool/read.txt`
  - JSON Schema：把工具的参数格式发给 LLM

- **3.3 实现 tool loop：检测、执行、喂回、循环**
  - 修改 chatStream：检测响应里的 tool_calls
  - 执行工具：根据 tool name 找到对应工具，调用 execute
  - 喂回结果：把工具结果以 `role: "tool"` 消息加入 messages
  - 循环：继续调 LLM，直到它不再返回 tool_calls
  - max_steps：防止无限循环
  - 对照 opencode：看 `session/prompt.ts` 的 runLoop

- **3.4 阶段验收：能读文件的 agent + 工程思维总结**
  - 跑通：问 AI "src/llm.ts 里写了什么" → AI 调 read 工具 → 回答内容
  - 对照 opencode：我们的 tool loop vs opencode 的 runLoop
  - 工程思维：tool loop 是 agent 的本质——LLM 是大脑，工具是手脚
  - 预告阶段 4：更多工具（write、edit、bash 等）

### 阶段 4：工具集

> **目标**：实现 write、edit、bash、grep、glob 五个核心工具，让 agent 能读写文件、执行命令、搜索代码。每个工具遵循 3.2 课的 Tool 接口模式。
>
> **产出**：一个能读写文件、执行命令、搜索代码的 agent。

#### 课程

- **4.1 write + edit：文件写入与编辑**
  - write 工具：写文件（Bun.write）
  - edit 工具：精确字符串替换（oldString → newString）
  - edit 的 replaceAll 参数：替换所有匹配
  - 对照 opencode：看 `tool/write.txt`、`tool/edit.txt` 的描述
  - 为什么 edit 要要求先 read（防止盲目编辑）

- **4.2 bash：执行 shell 命令**
  - bash 工具：用 Bun.spawn 执行命令
  - 捕获 stdout/stderr/exit code
  - 命令超时处理
  - 对照 opencode：看 `tool/shell.ts` 和 `tool/shell/shell.txt`
  - 安全考虑：为什么不直接给 LLM shell 访问（阶段 10 的权限系统预告）

- **4.3 grep + glob：搜索工具**
  - glob 工具：按文件名模式匹配（`**/*.ts`）
  - grep 工具：按文件内容搜索（正则表达式）
  - Bun.Glob 和正则匹配
  - 对照 opencode：看 `tool/glob.txt`、`tool/grep.txt`
  - 工具协作：glob 找文件 → read 读内容 → edit 修改

- **4.4 工具输出截断 + 阶段验收**
  - 为什么需要截断：工具输出太长会撑爆 LLM 上下文
  - 实现简单的截断策略（最大行数/字节数）
  - 对照 opencode：看 `tool/truncate.ts` 的截断逻辑
  - 验收：agent 能读写文件、执行命令、搜索代码
  - 工程思维：声明式工具定义的扩展性——加工具不改 tool loop

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
- [x] 阶段 1：最小 Agent（一次 LLM 调用）
- [x] 阶段 2：流式输出
- [x] 阶段 3：工具循环（Agent 的核心）
- [ ] 阶段 4：工具集
- [ ] 阶段 5：Session 持久化
- [ ] 阶段 6：Provider 抽象
- [ ] 阶段 7：System Context & AGENTS.md
- [ ] 阶段 8：CLI 入口
- [ ] 阶段 9：TUI 终端界面（选做）
- [ ] 阶段 10：高级特性（选做）

> **下一步**：开始阶段 4「工具集」—— 实现 write、edit、bash 等更多工具。
