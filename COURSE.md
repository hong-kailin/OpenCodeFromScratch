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
- [x] 阶段 4：工具集
- [x] 阶段 5：Session 持久化
- [x] 阶段 6：Provider 抽象
- [x] 阶段 7：System Context & AGENTS.md
- [x] 阶段 8：CLI 入口
- [x] 阶段 9：TUI 终端界面（选做）
- [ ] 阶段 10：高级特性（选做）

> **下一步**：阶段 9 已完成（含 9.5 工具调用 spinner 展示 + 阶段验收）。可选做阶段 10「高级特性」—— Permission 系统、MCP、Subagent、Compaction、Plugin。
