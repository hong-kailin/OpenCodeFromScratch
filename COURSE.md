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

> **目标**：用 SQLite + Drizzle ORM 把对话历史存到数据库，重启程序后能恢复之前的对话。
>
> **产出**：`bun run src/index.ts` 启动时能选择恢复之前的 session，对话历史从数据库加载。

#### 课程

- **5.1 SQLite + Drizzle：数据库搭建与表设计**
  - 为什么需要持久化：目前 messages 在内存里，重启就没了
  - SQLite：轻量级文件数据库（类比 Python 的 sqlite3）
  - Drizzle ORM：TS 的 ORM（类比 SQLAlchemy）
  - 安装 drizzle-orm + bun:sqlite
  - 设计表结构：session 表（id、title、time_created）、message 表（id、session_id、role、content、tool_calls、time_created）
  - 对照 opencode：看 `core/src/session/sql.ts` 的表定义（比我们复杂得多）
  - 数据库文件位置（对照 opencode：`~/.local/share/opencode/opencode.db`）

- **5.2 Session CRUD：创建、列表、加载**
  - 创建 session：INSERT 一行到 session 表
  - 列出 sessions：SELECT 所有 session
  - 加载 session：SELECT session by id
  - 生成 session ID（ulid 或时间戳）
  - 对照 opencode：看 `session.ts` 的 create 函数

- **5.3 Message 存储：保存和加载对话历史**
  - 保存消息：每次 user/assistant/tool 消息 INSERT 到 message 表
  - 加载历史：SELECT message by session_id，按 time_created 排序
  - JSON 序列化：tool_calls 存为 JSON 字符串
  - 对照 opencode：它的消息拆成 message + part 两表，我们用单表简化

- **5.4 集成到 agent：重启恢复对话**
  - 启动时选择：新建 session 还是恢复已有
  - 恢复时从数据库加载 messages，继续对话
  - 每轮对话自动存入数据库
  - 对照 opencode：它的 session 管理有多层（project、workspace、parent）
  - 产出：重启后能恢复之前的对话

- **5.5 阶段验收：持久化 agent + 工程思维总结**
  - 跑通：新建 session → 对话 → 重启 → 恢复 → 继续对话
  - 对照 opencode：我们的直接 CRUD vs opencode 的事件溯源 + 投影
  - 工程思维：为什么 opencode 用事件溯源？什么时候该用它？
  - 预告阶段 6：Provider 抽象

### 阶段 6：Provider 抽象

> **目标**：从硬编码 OpenAI 格式抽象出 Provider 接口，理解 opencode 的 Route 四轴模型（Protocol + Endpoint + Auth + Framing），学会正交组合的设计思想。
>
> **产出**：Provider 接口 + OpenAI provider 实现，配置文件支持多 provider 切换，Anthropic provider 代码作为参考（不跑）。

#### 课程

- **6.1 为什么需要 Provider 抽象 + 接口设计**
  - 当前代码的问题：chatWithTools 硬编码 OpenAI 格式（URL、请求体、响应解析）
  - N×M×K 问题：N 个 provider × M 种 API 协议 × K 种认证方式
  - opencode 的解法：Route 四轴正交分解（Protocol + Endpoint + Auth + Framing）
  - 定义我们的 Provider 接口：`chatWithTools(messages, tools, onChunk) → ChatResult`
  - 把 llm.ts 重构成 OpenAIProvider，agent 代码通过接口调用
  - 配置文件支持多 provider：opencode.json 里写多个 provider，model 字段切换

- **6.2 Anthropic Messages API：不同的协议**
  - OpenAI Chat Completions vs Anthropic Messages API 的差异
  - 消息格式差异（system 独立字段 vs 在 messages 里）
  - tool calls 差异（tool_calls 数组 vs content blocks）
  - 流式差异（SSE delta vs content_block_delta 事件类型）
  - 写 Anthropic Provider 代码（不跑，纯讲设计）
  - 对照 opencode：Protocol 层怎么隔离这些差异

- **6.3 对照 opencode Route 四轴模型 + 阶段验收**
  - 我们的 Provider 接口 vs opencode 的 Route（Protocol + Endpoint + Auth + Framing）
  - 正交组合的威力：DeepSeek/TogetherAI/Cerebras 复用 OpenAI protocol 只需 3 行
  - 简单接口 vs Route 模型的 trade-off：什么时候该演进
  - 验收：typecheck 通过、provider 可切换、OpenAI provider 跑通
  - 工程思维：正交分解——把 N×M×K 降成 N+M+K

### 阶段 7：System Context & AGENTS.md

> **目标**：把硬编码的 system prompt 改成动态组装——环境信息 + AGENTS.md 项目指令，让 agent 能读取项目指令并遵守。
>
> **产出**：`bun run src/index.ts` 启动时自动加载 AGENTS.md，system prompt 包含环境信息和项目指令。

#### 课程

- **7.1 环境信息：给 LLM 上下文**
  - 当前问题：system prompt 是硬编码字符串，LLM 不知道当前日期、工作目录等
  - LLM 需要什么环境信息：日期、平台、工作目录、是否 git 仓库
  - 对照 opencode：看 `session/system.ts` 的 environment 函数
  - 实现 `src/system-context.ts`：组装环境信息
  - 替换 index.ts 里的硬编码 system prompt

- **7.2 AGENTS.md 加载：项目指令**
  - AGENTS.md 是什么：给 AI 的项目指令（自由格式 markdown）
  - 加载项目根目录的 AGENTS.md
  - findUp 搜索：从当前目录向上找，收集所有 AGENTS.md
  - 全局 AGENTS.md（~/.config/opencode/AGENTS.md）
  - 拼接：环境信息 + AGENTS.md → 完整 system prompt
  - 对照 opencode：看 `session/instruction.ts` 的搜索逻辑

- **7.3 对照 opencode + 阶段验收**
  - opencode 的 7 组件 system prompt（base + env + instructions + mcp + skills + structured + user）
  - 我们的 2 组件简化版
  - 每次调用重新组装 vs 一次性（opencode 每轮都重新读 AGENTS.md）
  - 验收：修改 AGENTS.md → 下一轮对话生效
  - 工程思维：system prompt 是 agent 的"操作手册"

### 阶段 8：CLI 入口

> **目标**：用 yargs 构建 CLI，把 `src/index.ts` 的裸 `while(true) + prompt()` 改成正式的命令行工具，支持 `--continue`/`--session` 等选项。
>
> **产出**：`bun run src/index.ts run "你好"` 单次运行，`bun run src/index.ts run -c` 恢复上次会话。

#### 课程

- **8.1 yargs 构建 CLI：命令与选项**
  - yargs 是什么（类比 Python 的 argparse/click）
  - 安装 yargs，定义 `run` 命令
  - 把 index.ts 的逻辑搬进 `run` 命令的 handler
  - 选项：`--continue`/`-c`（恢复上次）、`--session`/`-s`（指定 session ID）、`-m`/`--model`（指定 model）
  - 非交互模式：`bun run src/index.ts run "你好"` 直接发一条消息
  - 对照 opencode：看 `src/index.ts` 的 yargs 配置和 `cli/cmd/run.ts`

- **8.2 yargs 中间件：全局前置处理**
  - 什么是中间件：在命令 handler 之前运行的函数
  - 为什么需要：跨命令的通用逻辑（设置环境变量、日志级别等）
  - 执行顺序：builder → middleware → handler
  - 实现 --debug 全局选项 + middleware 设置环境变量
  - 对照 opencode：看 `src/index.ts` 的 middleware（选项转环境变量）

- **8.3 对照 opencode + 阶段验收**
  - opencode 的 CLI 架构：23 个子命令、effectCmd 包装器（Effect-TS 后续阶段讲）
  - 我们的 1 命令 + middleware 简化版
  - `run` 命令的 3 种模式（非交互、交互本地、交互 attach）
  - 验收：`run "你好"` 单次、`run -c` 恢复、`run -s <id>` 指定恢复、`--debug` 调试模式
  - 工程思维：CLI 是 agent 的"外壳"——用户交互的入口

### 阶段 9：TUI 终端界面

> **目标**：用 opentui/solid 构建终端 UI，替换 `prompt()` + `console.log` 的交互方式，实现消息流渲染、输入框、工具调用展示。
>
> **产出**：`bun run src/index.ts tui` 启动终端 UI，在终端里对话、看流式输出、看工具调用。

#### 前置知识

- JSX：HTML-like 语法写在 TypeScript 里（不是字符串模板）
- SolidJS 响应式：createSignal（响应式变量）、createMemo（计算属性）、createEffect（副作用）
- 控制流组件：`<Show>`（条件渲染）、`<For>`（列表渲染）
- opentui 终端元素：`<box>`、`<text>`、`<scrollbox>`、`<textarea>`

#### 课程

- **9.1 JSX + SolidJS：响应式编程入门**
  - JSX 是什么：在 TypeScript 里写 HTML 风格的标签（不是字符串）
  - SolidJS 响应式：createSignal（变量变了自动更新 UI）、createMemo（计算值）、createEffect（副作用）
  - 控制流组件：`<Show>`（条件渲染）、`<For>`（列表渲染）
  - Python 类比：signal = 可观察变量，改了自动通知；memo = 计算属性；effect = 响应式回调
  - 对照 opencode：看 `packages/tui/src/context/sync.tsx` 的 createStore

- **9.2 opentui 终端渲染：第一个 TUI**
  - opentui 元素：`<box>`（容器）、`<text>`（文本）、`<scrollbox>`（滚动区）
  - render() 函数：把组件挂载到终端
  - `--conditions=browser` 的原因（SolidJS 客户端 vs server 版本）
  - jsxImportSource 配置
  - 写第一个 TUI：显示标题 + 计数器
  - 对照 opencode：看 `packages/tui/src/app.tsx` 的 render 调用

- **9.3 消息流渲染：列表 + 流式文本**
  - 消息列表组件：`<For>` 遍历 messages 数组
  - 不同角色不同样式：user（左边框）、assistant（绿色文本）、tool（灰色）
  - 流式文本：signal 更新 → SolidJS 自动重渲染
  - `<scrollbox>` 自动滚动到底部
  - 对照 opencode：看 `routes/session/index.tsx` 的消息渲染

- **9.4 输入框 + 集成到 agent**
  - `<textarea>` 组件：onContentChange、onSubmit
  - 连接到 agent loop：提交消息 → 调 provider → 流式渲染回复
  - 替换 prompt() + console.log
  - 添加 `tui` 命令到 CLI
  - 对照 opencode：看 `component/prompt/index.tsx`

- **9.5 工具调用展示 + 阶段验收**
  - 工具调用状态展示：spinner（执行中）→ 结果（完成）
  - `[调用工具] read(...)` 的可视化
  - 验收：TUI 里对话、流式输出、工具调用展示
  - 对照 opencode：看 `routes/session/index.tsx` 的 ToolPart 组件
  - 工程思维：TUI 是"渲染层"——只管显示，不管业务逻辑


### 阶段 10：Effect-TS 入门（从痛点出发）

> **目标**：引入 Effect-TS 的核心三件套--Service/Layer（依赖注入）、Stream（流式）、Schema（运行时校验），用它们重构现有 agent loop。功能完全不变，但架构从"裸 async/await + 参数到处传"升级到"Effect 服务化"。
>
> **为什么现在做**：前 9 阶段我们用裸 async/await，能跑。但随着功能增多，config、provider、db、session 这些依赖要在每个函数间手动传递，越来越乱。这正是 opencode 用 Effect-TS 的根本原因--Service/Layer 提供依赖注入，让"谁需要什么服务"由 Context 自动提供，不用层层传参。先感受到痛点，再用 Effect 解决，理解才深刻。
>
> **核心主题**：
> - Effect.gen 与 Effect 流水线（对照 Python 的 async + Result 类型）
> - Service + Layer：定义服务、提供实现、从 Context 取用（对照依赖注入容器）
> - Effect Stream：替代 ReadableStream，流式处理的函数式抽象
> - Effect Schema：声明式数据契约 + 运行时校验（对照 dataclass + pydantic）
> - 错误处理：Effect 的 typed error channel（对照 Python 的 try/except 但类型化）
>
> **产出**：agent loop 用 Effect 重构，config/provider/db 变成 Service，从 Context 取用而非传参。

### 阶段 11：Monorepo 拆分 + Schema 契约层

> **目标**：把单 package 拆成 Bun workspaces monorepo，先抽出 `schema` 包作为最底层的共享契约层。
>
> **为什么现在做**：单 package 里类型定义和业务逻辑混在一起，加新功能时类型重复定义、边界模糊。opencode 的 37 个 package 以 `schema` 为叶子节点--所有领域契约（Session/Message/Part/ToolPart/ToolState/Provider/Model/Permission）都定义在 schema 包，被 core/protocol/server/client 共享。先拆 schema 包，建立"契约层"概念。
>
> **核心主题**：
> - Bun workspaces：monorepo 配置与包间引用
> - package 分层边界：schema 是叶子（只依赖 effect），上层依赖下层
> - 把现有 interface/类型搬到 schema 包，用 Effect Schema 重写
> - 对照 opencode：`packages/schema/src/` 的 28 个领域 schema
>
> **产出**：`packages/{schema, opencode}` 两层结构，所有共享类型在 schema 包。

### 阶段 12：Core 领域服务化

> **目标**：把 session/provider/tool/database/filesystem 等领域逻辑重构成 Effect Service，搬进新建的 `core` 包。
>
> **为什么现在做**：现在这些领域逻辑散在 src/ 各文件，没有统一服务边界。opencode 的 core 包是最大的领域包，每个领域是一个 Effect Service（Database、Filesystem、Provider、Tool 注册表、SystemContext）。服务化后，agent 通过 Context 访问任意服务，可替换实现（测试时 mock）。
>
> **核心主题**：
> - Database 服务：Effect 化的 Drizzle + SQLite（对照 opencode 的 `effect-drizzle-sqlite`）
> - Filesystem 服务：封装文件读写、glob、grep
> - Tool 注册表服务：工具的注册与查找
> - SystemContext 服务：组装 system prompt
> - Provider 服务：封装 LLM 调用（阶段 14 升级成 Route）
> - 对照 opencode：`packages/core/src/` 的领域文件 + 同名子目录结构
>
> **产出**：`packages/{schema, core, opencode}` 三层结构，agent 通过 Context 取用 core 服务。

### 阶段 13：Session 事件溯源

> **目标**：把 session 持久化从"直接 CRUD"重构成"事件溯源 + 投影"--所有状态变化先写成 durable event，再由 projector 投影成可查询视图。
>
> **为什么现在做**：当前的直接 CRUD 有硬伤：无法 revert（回滚到某步）、无法精确恢复中途状态、无法压缩历史。opencode 的 session 是事件溯源：以 sessionID 为聚合根、事件带递增 seq、投影器把事件应用到 DB 表。这是 opencode 最精巧的设计之一，也是 Effect Stream + Service 的最佳实践场。
>
> **核心主题**：
> - 事件元模型：Event.define（type + durable + data schema）
> - EventV2 服务：publish（持久化+通知）、subscribe、project、replay
> - 投影器：为每种事件注册投影函数，事件 -> DB 表
> - 事件表 + 序列表 + 投影表（vs 我们的单表）
> - 从投影重建对话历史
> - admit/promote 两阶段 prompt 投递
> - 对照 opencode：`schema/src/session-event.ts`（30 种事件）、`core/src/session/projector.ts`
>
> **产出**：session 状态由事件流驱动，支持从事件重建、revert 回滚。

### 阶段 14：LLM Route 四轴模型

> **目标**：把简单 Provider 接口升级成 Route 四轴模型（Protocol + Endpoint + Auth + Framing），抽出独立的 `llm` 包。
>
> **为什么现在做**：当前加一个新 provider 要复制粘贴整份代码，协议差异（OpenAI vs Anthropic）混在 Provider 实现里。opencode 的 Route 把"调一个 LLM API"分解成四个正交维度：Protocol（说哪种协议）、Endpoint（发去哪）、Auth（怎么认证）、Framing（怎么切流）。四轴组合后，DeepSeek/TogetherAI 等 OpenAI 兼容厂商只需几行复用同一 Protocol。
>
> **核心主题**：
> - Protocol：body schema + stream 状态机（把 provider event 翻译成通用 LLMEvent）
> - Endpoint：声明式 URL 构造
> - Auth：可组合的认证（bearer/header/config，支持 andThen/orElse）
> - Framing：字节流 -> 帧（SSE / 二进制 event-stream）
> - Route.make：四轴组合
> - Provider Turn 完整流程：compile -> stream -> 状态机翻译
> - 对照 opencode：`packages/llm/src/route/`、`packages/llm/AGENTS.md`
>
> **产出**：`packages/{schema, core, llm, opencode}` 四层，多厂商 protocol 复用。

### 阶段 15：Server + Protocol + Client

> **目标**：引入 HTTP server（Effect HttpApi + Hono）+ SSE 事件流 + 生成 client SDK，把 TUI 和 agent 拆成两个进程。
>
> **为什么现在做**：当前 TUI 和 agent 耦合在单进程，无法支持 web/desktop 等多客户端。opencode 把 agent 跑在 server 进程，TUI/web/desktop 通过 HTTP + SSE 连接。引入 `protocol` 包（用 Effect HttpApi 声明式定义 API）+ `server` 包（接上 handler 实现）+ `client` 包（生成的 SDK）。这是从"单进程应用"到"客户端-服务端架构"的关键跃迁。
>
> **核心主题**：
> - Effect HttpApi：声明式定义 API（endpoint + schema）
> - protocol 包：18 个 API group 的定义（不含实现）
> - server 包：HttpApiBuilder.layer，handler 接 core 服务
> - SSE：session 事件流实时推给客户端
> - client 包：从 protocol 生成的客户端 SDK
> - TUI 改造成连 server 的客户端（两进程架构）
> - 对照 opencode：`packages/protocol/`、`packages/server/`、`packages/client/`
>
> **产出**：两进程架构，`bun run server` 跑 agent，TUI 通过 HTTP 连接。

### 阶段 16：Permission 系统

> **目标**：给工具执行加上权限检查--危险操作（写文件、跑命令）执行前询问用户确认。
>
> **为什么现在做**：当前工具能直接改文件、跑任意命令，没有任何确认环节。opencode 的 permission 系统在工具执行前检查规则（allow/ask/deny），可配置。配合阶段 17 的 agent 定义，不同 agent 有不同权限边界（build 全权限、plan 只读）。
>
> **核心主题**：
> - 权限规则定义与匹配（allow/ask/deny）
> - 工具执行前的权限拦截流程
> - 权限持久化（记住用户选择）
> - 对照 opencode：`packages/opencode/src/permission/`、`core/src/permission/`
>
> **产出**：工具执行前有权限流程，危险操作需确认。

### 阶段 17：Agent 定义 + Subagent

> **目标**：从单一 agent 扩展到多 agent 体系--build（全权限）、plan（只读）、general（子 agent），实现 task 工具委派子 session。
>
> **为什么现在做**：现在只有一个 agent 干所有事。opencode 的 agent 是可配置的：每个 agent 定义自己的 tools、permissions、system prompt。task 工具能 spawn 子 session（subagent），父 agent 委派任务给子 agent，子 session 有独立的 sessionID 和 parent_id。这是"分而治之"在 agent 上的体现。
>
> **核心主题**：
> - Agent 配置：tools + permissions + prompt + model
> - build / plan / general 三种 agent 的差异
> - task 工具：spawn 子 session，等待结果返回
> - parent_id 层级（子 session 的父子关系）
> - 对照 opencode：`packages/opencode/src/agent/`、`tool/task/`
>
> **产出**：多 agent 切换，task 工具委派子 agent。

### 阶段 18：更多工具

> **目标**：补全 opencode 的完整工具集--todowrite、webfetch、websearch、question、skill、apply_patch。
>
> **为什么现在做**：当前只有 6 个基础工具（read/write/edit/bash/grep/glob）。opencode 还有：todowrite（任务清单管理）、webfetch（抓网页）、websearch（联网搜索）、question（向用户提问）、skill（加载技能）、apply_patch（批量补丁）。每个工具有描述文件（.txt）+ 实现，遵循统一的 Tool 接口。
>
> **核心主题**：
> - todowrite：结构化任务清单（LLM 自我规划）
> - webfetch + websearch：联网能力（HTML 解析、搜索 API）
> - question：agent 主动向用户提问
> - skill + apply_patch
> - 工具描述文件的作用（给 LLM 看的说明）
> - 对照 opencode：`packages/opencode/src/tool/`
>
> **产出**：完整工具集，agent 能力全面。

### 阶段 19：MCP 支持

> **目标**：集成 Model Context Protocol，让 agent 能接入外部 MCP server 扩展工具。
>
> **为什么现在做**：工具都内置在代码里，扩展要改源码。MCP 是标准协议，让外部 server 提供工具/资源/prompt，agent 动态发现并调用。opencode 支持 MCP server 配置，自动注册成工具。这是 agent 生态扩展的关键。
>
> **核心主题**：
> - MCP 协议：tools/resources/prompts 三类能力
> - MCP client：连接外部 server，发现能力
> - MCP server 配置（opencode.json 里配）
> - 自动注册成 Tool
> - 对照 opencode：MCP 集成代码
>
> **产出**：配置 MCP server 后，工具自动可用。

### 阶段 20：Compaction + 高级特性

> **目标**：实现长对话压缩（compaction）、会话回滚（revert）、插件系统（plugin）、LSP 诊断集成。
>
> **为什么现在做**：长对话会撑爆 LLM 上下文窗口。compaction 把旧消息压缩成摘要，腾出空间。revert 让用户回滚到某一步。plugin 系统让外部代码扩展 agent。LSP 集成让 agent 在编辑代码时拿到语言诊断。这些都是 opencode 生产级 agent 的成熟特性。
>
> **核心主题**：
> - Compaction：压缩策略、压缩事件、从压缩点重建历史
> - Revert：基于事件 seq 的回滚
> - Plugin 系统：插件 SDK、钩子
> - LSP 集成：诊断信息喂给 LLM
> - 对照 opencode：`session/compaction.ts`、`session/revert.ts`、`packages/plugin/`
>
> **产出**：长对话可压缩、可回滚、可插件扩展、有 LSP 诊断。

### 阶段 21：Web UI + Desktop

> **目标**：在 TUI 之外，增加 Web UI（SolidJS）和桌面应用（Electron），复用同一套 server + client。
>
> **为什么现在做**：阶段 15 的 server/client 架构让多端成为可能。opencode 有 `app`（SolidJS web）、`desktop`（Electron）、`ui`（共享组件库）、`session-ui`（共享会话渲染）。它们都连同一个 server，只是渲染层不同。
>
> **核心主题**：
> - SolidJS Web UI：Vite + 组件
> - 共享组件库（ui 包）：theme、i18n、icons
> - session-ui：markdown 流、diff、代码块渲染
> - Electron 桌面应用：main + preload + renderer
> - 对照 opencode：`packages/app/`、`packages/desktop/`、`packages/ui/`
>
> **产出**：Web 和桌面端可用，与 TUI 共享同一 server。

---

## 路线图全景

前 9 阶段（已完成）走的是"简化版能跑"路线--用最少抽象把 agent loop 跑通。阶段 10-21 是"演进到 1:1 复刻"路线--每个阶段因为一个具体痛点引入 opencode 的对应抽象：

| 阶段 | 解决的痛点 | 引入的 opencode 抽象 |
|------|-----------|---------------------|
| 10 | 依赖到处传 | Effect Service/Layer/Stream/Schema |
| 11 | 类型重复、边界模糊 | schema 契约层 + Bun workspaces |
| 12 | 领域逻辑散乱 | core 领域服务化 |
| 13 | 无法 revert/恢复/压缩 | Session 事件溯源 |
| 14 | 加 provider 要复制粘贴 | LLM Route 四轴模型 |
| 15 | TUI 与 agent 耦合 | Server + Protocol + Client |
| 16 | 工具能乱改无确认 | Permission 系统 |
| 17 | 单 agent 干所有事 | Agent 定义 + Subagent |
| 18 | 工具不够用 | 完整工具集 |
| 19 | 工具扩展要改源码 | MCP 支持 |
| 20 | 长对话爆上下文 | Compaction + revert + plugin + LSP |
| 21 | 只有 TUI | Web UI + Desktop |

> **注意**：阶段 10-21 是路线图级规划，进入每个阶段前才细化具体课程内容（与阶段 0-9 一致的活文档原则）。顺序可能根据实际学习情况调整，但"动机驱动 + 渐进演进"的核心不变。

## 当前状态

- [x] 阶段 0：环境与基础（TypeScript + Bun 起步）
- [x] 阶段 1：最小 Agent（一次 LLM 调用）
- [x] 阶段 2：流式输出
- [x] 阶段 3：工具循环（Agent 的核心）
- [x] 阶段 4：工具集
- [x] 阶段 5：Session 持久化
- [x] 阶段 6：Provider 抽象
- [x] 阶段 7：System Context & AGENTS.md
- [x] 阶段 8：CLI 入口
- [x] 阶段 9：TUI 终端界面
- [ ] 阶段 10：Effect-TS 入门（从痛点出发）
- [ ] 阶段 11：Monorepo 拆分 + Schema 契约层
- [ ] 阶段 12：Core 领域服务化
- [ ] 阶段 13：Session 事件溯源
- [ ] 阶段 14：LLM Route 四轴模型
- [ ] 阶段 15：Server + Protocol + Client
- [ ] 阶段 16：Permission 系统
- [ ] 阶段 17：Agent 定义 + Subagent
- [ ] 阶段 18：更多工具
- [ ] 阶段 19：MCP 支持
- [ ] 阶段 20：Compaction + 高级特性
- [ ] 阶段 21：Web UI + Desktop

> **下一步**：开始阶段 10「Effect-TS 入门」-- 这是后续所有阶段的基础，opencode 的灵魂。进入前先细化具体课程内容。
