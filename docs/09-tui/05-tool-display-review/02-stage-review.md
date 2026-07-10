# 9.5 阶段验收 + 工程思维总结

> 本课目标：验收阶段 9 的 TUI，对照 opencode 的架构，总结工程思维。

## 验收清单

```bash
# 1. 类型检查
bun run typecheck

# 2. 启动 TUI agent
bun run src/tui/agent.tsx
# 输入 "读一下 src/index.ts"
# 预期：spinner 转一下 -> 变成 ✓ read(...) + 文件内容预览 -> AI 回复文件说明

# 3. 测试多工具调用
# 输入 "列出 src 下的 ts 文件，然后读一下 agent-loop.ts"
# 预期：glob 工具（spinner -> ✓ + 文件列表）-> read 工具（spinner -> ✓ + 文件内容）-> AI 总结

# 4. 测试 bash 工具
# 输入 "运行 ls 看看当前目录有什么"
# 预期：bash 工具（spinner -> ✓ + ls 输出）-> AI 解读

# 5. VSCode 调试（见 04-input-agent/02-debug-tui.md）
bun --inspect=ws://localhost:6499/debug src/tui/agent.tsx
```

| 验收项 | 状态 |
|--------|------|
| typecheck 通过 | ✓ |
| TUI 对话 + 流式输出 | ✓ |
| 工具调用 spinner 动画 | ✓ |
| 完成后 spinner -> ✓ 状态切换 | ✓ |
| 结果预览截断 | ✓ |
| 多工具连续调用 | ✓ |
| 工具调用与结果关联（id） | ✓ |

## 阶段 9 修改的代码

```
src/
├── agent-loop.ts        # 修改：LoopCallbacks 加 id 参数（9.5）
└── tui/
    ├── hello.tsx        # 新增：9.2 第一个 TUI
    ├── messages.tsx     # 新增：9.3 消息列表 + 流式
    └── agent.tsx        # 新增：9.4 输入框+agent loop，9.5 加 spinner 状态切换
```

新增依赖：`@opentui/core`、`@opentui/solid`、`solid-js`、`opentui-spinner`

## 对照 opencode 的 TUI 架构

### 进程模型

| | 我们的 | opencode |
|---|--------|----------|
| 进程模型 | 单进程（TUI + agent loop 在一起） | 双进程（TUI 进程 + server 进程） |
| 通信方式 | 直接函数调用 + 回调 | HTTP + Server-Sent Events |
| agent loop 位置 | 在 TUI 进程里跑 | 在 server 进程里跑 |

opencode 把 TUI 和 agent 拆成两个进程，是因为 opencode 的 server 可以独立运行（`opencode serve`），多个客户端（TUI、Web、桌面）都能连同一个 server。我们只有一个 TUI 客户端，单进程就够。

### 消息模型

| | 我们的 | opencode |
|---|--------|----------|
| 消息结构 | `ChatMessage`（扁平，role + content + 可选工具字段） | `Message` + `Part`（一条消息拆成多个 part） |
| 工具调用 | 一条 `role: "tool"` 消息带状态 | 独立的 `ToolPart`，有自己的 id 和状态机 |
| 状态值 | running / completed | pending / running / completed / error |
| 工具展示 | 所有工具同一种样式 | 12 个工具各有专门组件 |

opencode 的消息模型是"事件溯源"--一条消息由多个 part 组成，每个 part 是一个事件（文本块、工具调用、reasoning）。这样可以精细追踪每一步。我们用扁平的 `ChatMessage` 简化。

### 渲染分层

| | 我们的 | opencode |
|---|--------|----------|
| 渲染层 | 直接在 `agent.tsx` 里写 JSX | `routes/session/index.tsx` + 多个组件 |
| spinner | 内联 `<spinner>` | 封装成 `component/spinner.tsx` |
| 工具展示 | 一种样式 | `<Switch>` 按工具名分发 12 个组件 |
| 主题 | 硬编码颜色 | `useTheme` 主题系统 |

## 工程思维总结

### 1. TUI 是"渲染层"--只管显示，不管业务逻辑

整个阶段 9 我们**没动 agent loop 的核心逻辑**。`runAgentLoop` 从 9.4 课开始就是"发 LLM -> 执行工具 -> 喂回结果"的循环，9.5 课只是改了回调接口（加 id）和 TUI 的渲染方式。业务逻辑和显示逻辑是解耦的：

```
agent loop（业务）  --回调-->  TUI（渲染）
   发 LLM                        setMessages
   执行工具                       spinner -> ✓
   喂回结果                       结果预览
```

loop 不关心怎么显示（console.log 还是 signal 还是存数据库），TUI 不关心怎么执行（调哪个 provider、跑哪个工具）。回调是它们之间的"合同"：`LoopCallbacks` 接口定义了 loop 会喊哪些事件，TUI 决定每个事件怎么显示。

> 对照 opencode：它的解耦更彻底--TUI 和 agent 是两个进程，通过 HTTP 通信。但解耦的思路是一样的：**业务层不知道渲染层的存在**。

### 2. 状态机思维：把"两条消息"变成"一条消息的两个状态"

9.4 课的工具调用是两条消息（调用 + 结果），本质上是把"一个工具调用的生命周期"拆成了两份独立数据。9.5 课改成一条消息带状态（running -> completed），这才是工具调用的本质--它是一个**有状态的过程**，不是两个独立事件。

这是状态机思维：识别出"这个东西有多个状态，状态会流转"，就把它建模成一个带状态的实体，而不是一堆离散事件。opencode 的 `ToolPart` 状态机（pending -> running -> completed/error）就是这个思路的完整版。

> **算法背景**：这和有限状态机（FSM）建模一样。与其用一堆 flag 和 if/else 描述"现在在哪个阶段"，不如显式定义状态和流转。状态机让非法状态不可能出现（你不能在 pending 时就有 output），代码更清晰。

### 3. 响应式编程：改数据，UI 自己更新

整个阶段 9 最核心的转变：从"命令式打印"（`console.log` / `process.stdout.write`）到"响应式更新"（`setMessages` -> SolidJS 自动重渲染）。

- 命令式：你告诉终端"打印这个字符"。改一处要手动重画整个屏幕。
- 响应式：你改 signal（数据），SolidJS 自动算出哪些 UI 依赖这个数据，只更新那些部分。

spinner -> ✓ 的切换就是典型：`onToolResult` 只改了 `msg.toolStatus` 从 `running` 到 `completed`，SolidJS 自动让 spinner 消失、✓ 出现、结果预览显示。你不用写"先删 spinner、再加 ✓、再显示结果"的命令式代码。

> 对照 Python：响应式类似 pandas 的惰性求值，或 Vue 的数据绑定--你改数据，依赖它的视图自动更新。和 Python 里手动 `print()` 重画整个输出是不同范式。

### 4. 副作用导入：import 不只为了拿东西

`import "opentui-spinner/solid"` 没导入任何变量，只为触发"注册 `<spinner>` 元素"的副作用。这种模式在 JS 生态很常见（polyfill、插件注册、CSS-in-JS 都是）。

判断一个 import 是不是"副作用导入"：看它有没有 `import { foo }` 的花括号。没有就是纯副作用导入。这类 import 的意义不在"拿到什么"，而在"导入这个模块时它做了什么注册"。

## 阶段 9 学了什么

| 课 | 知识点 |
|----|--------|
| 9.1 | JSX 语法、SolidJS 响应式（createSignal/createMemo/createEffect）、控制流组件（`<Show>`/`<For>`）、signal = 可观察变量 |
| 9.2 | opentui 终端渲染（`render`、`<box>`、`<text>`）、`--conditions=browser`、jsxImportSource |
| 9.3 | 消息列表渲染、流式文本（signal 追加 -> 自动重渲染）、`<scrollbox>` 自动滚动 |
| 9.4 | `<textarea>` + ref、`useKeyboard`、async agent loop 接 TUI（回调）、依赖注入、两套 messages 分离 |
| 9.5 | 工具调用状态机、spinner 动画（Braille 帧 + `opentui-spinner`）、回调 id 关联、原地更新 vs 新增、副作用导入 |

你现在是"有终端 UI 的 agent"--能对话、能流式输出、能用工具、工具调用有动画反馈。核心 agent loop 和阶段 8 完全一样，只是套了一层 TUI 渲染。

---

下一步：阶段 9 是"选做"阶段，已完成。可以跳到 [阶段 10：高级特性（选做）](../../10-advanced/) -- Permission 系统、MCP、Subagent、Compaction 等。
