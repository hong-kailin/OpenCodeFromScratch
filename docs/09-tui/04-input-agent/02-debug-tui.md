# 9.4 附：如何在 VSCode 里 debug opentui TUI

> 本课目标：学会用断点调试 opentui + Bun 的 TUI 程序，特别是交互式 TUI 的调试方法。

> 前置：[0.6 VSCode 调试](../../00-env-basics/06-vscode-debug/README.md) 讲过断点、单步执行、调试面板等基础。本课只讲 TUI 特有的问题。

## 为什么 TUI 调试和普通程序不一样

阶段 0 学的调试方法：打开文件 -> 设断点 -> F5 -> 程序暂停。这对 `src/index.ts` 这种 CLI 程序完全够用。

但 opentui TUI 有个本质区别：**它会接管终端的 raw mode**。要理解这句话，先看终端输入的两种模式。

### 行缓冲模式：你熟悉的输入方式

在普通终端里，程序的输入是"行缓冲"的：

- 你打字 `hello`，屏幕上显示 `hello`
- 但程序**收不到任何东西**，字符被终端截留了
- 你按 `Enter`，终端才把整行 `hello` 一次性交给程序
- 退格、方向键移动光标这些编辑功能，都是**终端帮你做的**，程序不参与

类比 Python 的 `input()`：你调 `input("姓名: ")`，Python 会一直阻塞，直到你按 Enter 才收到整行字符串。中间你打字、退格、改来改去，Python 完全不知道。

### Raw mode：每个按键立即送达

程序可以告诉操作系统："别帮我缓冲了，每个按键直接给我"。这就是 raw mode。

- 你按 `a`，程序立刻收到 `'a'`
- 你按退格，程序立刻收到退格信号
- 你按方向键 ↑，程序立刻收到 `\x1b[A`（方向键的转义序列）
- **没有任何缓冲，也没有终端帮你处理编辑**

Python 里的 `curses` 库（或 `tty.setraw()`）就是切到这个模式。

### 为什么 opentui 需要 raw mode？

因为 opentui 要做**自己的输入框**--`agent.tsx` 里的 `<textarea>`。这个输入框要：

- 实时显示你打的每个字
- 支持退格删除
- 支持方向键移动光标
- 监听 `Enter` 提交消息

这些功能 opentui 自己实现，不需要终端帮忙。所以它必须切到 raw mode，自己接收并处理每个按键。

### 为什么调试控制台不行？

这涉及到一个概念：**TTY**（终端设备）。

你开的 Terminal.app / iTerm 是真终端设备，支持 raw mode。VSCode 的**调试控制台**不是终端设备--它只是 VSCode 界面上的一个文本输入框。当 opentui 调用操作系统的"把 stdin 切到 raw mode"时，因为 stdin 连的不是真终端，这个调用要么失败要么没效果，**键盘输入就废了**。

```
你在 Terminal.app 里跑 agent.tsx：
  stdin -> 真 TTY -> raw mode 生效 -> 键盘正常 ✓

你在 VSCode 调试控制台里跑 agent.tsx：
  stdin -> 调试控制台文本框（不是 TTY）-> raw mode 失败 -> 键盘废了 ✗
```

VSCode 调试时有三个地方可以跑程序。先解释清楚这三个分别是什么：

**1. 调试控制台（Debug Console）**

就是按 F5 开始调试后，VSCode 底部自动弹出的那个面板。它主要用来**看调试输出**（程序里的 `console.log` 会打印到这里）和**输入调试命令**。它不是一个终端--你不能在这里敲 `ls`、`bun run` 之类的命令，它也不被操作系统认作 TTY。Bun 扩展的 launch 模式默认就是把程序挂在这里跑的。

**2. 集成终端（Integrated Terminal）**

就是 VSCode 里自带的终端面板。打开方式：菜单 `View -> Terminal`，或快捷键 `` Ctrl+` ``（反引号，在 Tab 键上方）。它长这样：

```
┌─ VSCode 窗口 ─────────────────────────────────┐
│                                               │
│   你的代码编辑区                                │
│                                               │
├───────────────────────────────────────────────┤
│  TERMINAL                                     │
│  $ bun run src/tui/agent.tsx     ← 这就是集成终端 │
│  ...                                          │
└───────────────────────────────────────────────┘
```

它是**真正的终端模拟器**，跑在 VSCode 窗口内部。操作系统认它是 TTY，raw mode 能用。你也可以在这里手动敲 `bun --inspect=ws://localhost:6499/debug src/tui/agent.tsx`，然后 F5 attach，效果和外部终端一样。

那为什么不直接用集成终端？因为调试时 VSCode 底部会同时显示**调试控制台**和**集成终端**两个面板，TUI 的全屏渲染和调试器的输出挤在一起，视觉上容易打架。能跑，但不舒服。

**3. 外部终端（External Terminal）**

就是 VSCode **外面**的独立终端应用--macOS 自带的 Terminal.app，或者 iTerm2、Warp 等第三方终端。它和 VSCode 是两个完全独立的窗口：

```
┌─ VSCode 窗口 ──────────┐    ┌─ Terminal.app 窗口 ──────┐
│                        │    │                          │
│  代码 + 断点            │    │  $ bun run tui:debug      │
│  调试面板（变量/调用栈）  │    │                          │
│                        │    │  ┌──────────────────┐    │
│                        │    │  │ AI 助手            │    │
│                        │    │  │ AI: 你好...        │    │
│                        │    │  │ [输入消息...]      │    │
│                        │    │  └──────────────────┘    │
│                        │    │     ↑ TUI 在这里跑        │
└────────────────────────┘    └──────────────────────────┘
       ↑ 断点在这里停                     ↑ 键盘在这里操作
```

TUI 在外部终端里独占整个窗口，显示和键盘都最干净。VSCode 只管断点和变量查看，通过网络（WebSocket）连到外部终端里的 Bun 进程。这就是 attach 模式的工作方式。

三者对比：

| 运行位置 | 是什么 | 是不是真 TTY | raw mode 能用吗 | 适合 |
|----------|--------|-------------|----------------|------|
| 调试控制台 | VSCode 调试面板里的输出区 | **不是** | 不能 | 非交互程序 |
| 集成终端 | VSCode 内置的终端面板（`` Ctrl+` ``） | 是 | 能，但和调试器输出挤在一起 | 简单 TUI |
| 外部终端 | VSCode 外面的独立终端应用（Terminal.app / iTerm） | 是 | 能，最干净 | 交互式 TUI |

**结论**：`hello.tsx` 这种只显示不交互的 TUI，用 launch 模式就行。`agent.tsx` 这种要键盘输入的交互式 TUI，必须用外部终端 + attach。

## launch 和 attach：两种调试模式

上面反复提到 launch 和 attach，先讲清楚它们是什么。launch.json 里每个配置都有一个 `"request"` 字段，值就是 `"launch"` 或 `"attach"`，决定了 VSCode 怎么对待你的程序。

### launch：VSCode 启动程序

**VSCode 是主导者**。你按 F5，VSCode 自己去启动程序（相当于 VSCode 帮你敲了 `bun run xxx.ts`），并且从一开始就把调试器挂上去。

```
你按 F5
   │
   ▼
VSCode 启动 bun 进程（附带调试器）
   │
   ▼
程序从第一行开始执行，断点随时能命中
```

类比 PyCharm：你点绿色的 Debug 按钮，PyCharm 自己启动 Python 解释器并挂上调试器。你不需要手动做任何事。

launch.json 里的配置告诉 VSCode "启动什么"：

```json
{
  "type": "bun",
  "request": "launch",       // ← launch 模式
  "name": "调试当前文件",
  "program": "${file}",       // ← 启动哪个文件
  "cwd": "${workspaceFolder}" // ← 在哪个目录启动
}
```

问题：VSCode 启动的程序，输入输出默认走**调试控制台**，而调试控制台不是 TTY。所以交互式 TUI 的键盘输入会废掉。

### attach：程序已经在跑，VSCode 连上去

**程序自己先启动**，VSCode 是后来才接上去的。

先打个比方：程序就像一个在厨房里干活的厨师。正常情况下厨师自己做饭，外面的人看不到里面在干嘛。`--inspect` 参数相当于在厨房墙上装了一个**对讲机**--厨师继续做饭，但外面的人可以通过对讲机说"做到第 3 步时停下来给我看看"，厨师到了第 3 步就会暂停并通过对讲机汇报情况。

对应到我们的场景：

```
第 1 步：你在终端里启动程序

   $ bun --inspect=ws://localhost:6499/debug src/tui/agent.tsx

   Bun 做了两件事：
   ① 启动你的程序（TUI 正常显示，键盘正常工作）
   ② 同时开一个"对讲机"，在 6499 端口上等着别人来连

   此时：程序在跑，对讲机开着但没人连，断点还没生效

         │
         ▼

第 2 步：你在 VSCode 里设断点，按 F5

   VSCode 读到 launch.json 里的 url: "ws://localhost:6499/debug"
   通过网络连到那个"对讲机"

   连上后 VSCode 做的第一件事：把你的断点位置告诉 Bun
   "agent.tsx 第 68 行有断点，执行到那里时暂停"

         │
         ▼

第 3 步：你在终端里操作 TUI（输入消息，按 Enter）

   程序执行到第 68 行 → Bun 暂停程序 → 通过对讲机告诉 VSCode
   "停在第 68 行了，这是当前的变量值"

   VSCode 收到后显示变量面板、调用栈，程序处于暂停状态

         │
         ▼

第 4 步：你在 VSCode 里查看变量、按 F5 继续

   VSCode 通过对讲机告诉 Bun "继续跑"
   Bun 恢复执行，直到下一个断点或程序结束
```

#### `--inspect=ws://localhost:6499/debug` 拆解

这个参数告诉 Bun "对讲机装在哪"：

| 部分 | 含义 |
|------|------|
| `ws://` | WebSocket 协议。类比 `http://`，但支持双向实时通信--VSCode 能发指令给程序，程序也能主动通知 VSCode（比如"我碰到断点了"）|
| `localhost` | 本机。VSCode 和终端在同一台电脑上，所以连本机就行 |
| `6499` | 端口号。Bun 默认用 6499，可以改成别的 |
| `/debug` | 路径。我们自己指定的固定路径，避免随机值（见后面"踩坑记录"）|

如果不带参数直接写 `--inspect`，Bun 会自动选一个端口和随机路径（如 `ws://localhost:6499/mfaylgcyw`）。我们指定完整地址是为了让 launch.json 里的 URL 能写死，每次都连得上。

#### "程序已经在跑，断点怎么会生效？"

你可能疑惑：程序都开始跑了，代码不是早就执行过去了吗？断点还有用吗？

有用。因为 TUI 程序不是"跑完就退出"的脚本，它是一个**事件循环**--启动后就一直等着你操作：

```
程序启动
  │
  ├→ 初始化（渲染 TUI 界面）     ← 这部分确实跑过了
  │
  └→ 事件循环（等你按键）         ← 一直停在这里，不会退出
       │
       你按 Enter → 触发 handleSubmit() → 调 LLM → onChunk 回调...
                                          ↑
                                     断点设在这里，等你触发
```

你 attach 上去之后，程序还在事件循环里等你操作。你在终端里输入消息按 Enter，代码才会执行到 `handleSubmit`、`onChunk` 这些函数--这时候断点就命中了。

> 如果你想调试**初始化阶段**的代码（比如 `render()` 之前的东西），用 `--inspect-wait` 代替 `--inspect`：程序会暂停在第一行，等 VSCode 连上后才开始执行。详见后面的"三个 inspect flag"。

#### Python 类比

Python 里用 `debugpy` 做 attach 调试：

```bash
# 终端里启动程序，开 5678 端口
python -m debugpy --listen 5678 myscript.py

# VSCode launch.json 里配置 attach
# {"type": "python", "request": "attach", "connect": {"host": "localhost", "port": 5678}}
```

Bun 的 `--inspect` 就是 Python 的 `--listen`，都是在程序启动时开一个调试端口，等 IDE 来连。

launch.json 里的配置告诉 VSCode "连去哪"：

```json
{
  "type": "bun",
  "request": "attach",                    // ← attach 模式
  "name": "Attach 到外部终端",
  "url": "ws://localhost:6499/debug",      // ← 连哪个地址
  "cwd": "${workspaceFolder}"
}
```

注意 attach 配置没有 `"program"` 字段--因为 VSCode 不负责启动程序，你自己在终端里启动。

### 核心区别

| | launch | attach |
|---|---|---|
| 谁启动程序 | VSCode 启动 | 你自己在终端启动 |
| 程序的输入输出 | 走 VSCode 调试控制台 | 走你启动它的那个终端 |
| 需要提前加参数 | 不需要，VSCode 全包 | 需要 `--inspect` 开调试端口 |
| 调试控制台是不是 TTY | 不是 | 不相关（程序在别的终端跑） |
| 适合 | 普通程序、非交互 TUI | 交互式 TUI |

一句话总结：**launch 是 VSCode 帮你启动程序并调试，attach 是你自己启动程序再让 VSCode 连上来调试**。交互式 TUI 必须用 attach，因为只有你自己在外部终端启动，程序才能拿到真 TTY。

## 方法一：launch 模式（非交互 TUI）

适合 `hello.tsx` 这种只显示、不需要键盘输入的程序。

`.vscode/launch.json` 里已有 **"调试当前文件"** 配置：

```json
{
  "type": "bun",
  "request": "launch",
  "name": "调试当前文件",
  "program": "${file}",
  "cwd": "${workspaceFolder}"
}
```

操作步骤：

1. 打开 `src/tui/hello.tsx`
2. 在想暂停的行（比如 `setInterval` 那行）点行号左侧设断点
3. 按 `F5`，选 "调试当前文件"
4. 程序启动，断点命中后暂停

> Bun 扩展会自动读取 `bunfig.toml` 里的 `preload`，所以 opentui 的 Solid JSX 转换正常生效，`.tsx` 文件能直接调试。

## 方法二：attach 模式（交互式 TUI）

这是本课的重点。`agent.tsx` 有输入框、键盘监听，必须在真终端里跑。

### 整体思路

```
外部终端                      VSCode
┌──────────────────┐         ┌──────────────────┐
│ bun --inspect=... │         │ 设断点            │
│   agent.tsx       │         │                  │
│                  │         │ F5 -> Attach      │
│ TUI 正常显示      │◄────────│ 连上 inspector    │
│ 键盘输入正常      │  WebSocket│                  │
│                  │         │ 断点命中 -> 暂停   │
│ ▼ 在这里操作      │         │ ▼ 在这里看变量     │
└──────────────────┘         └──────────────────┘
```

TUI 在外部终端里跑（键盘输入正常），VSCode 通过 WebSocket 连上 Bun 的 inspector，断点和变量查看都在 VSCode 里。

### 第 1 步：在外部终端启动 inspector

打开 macOS Terminal 或 iTerm（**不是 VSCode 内置终端**），在项目目录下运行：

```bash
bun run tui:debug
```

这个 npm script 等价于：

```bash
bun --inspect=ws://localhost:6499/debug src/tui/agent.tsx
```

你会看到 Bun 的 inspector 输出：

```
--------------------- Bun Inspector ---------------------
Listening:
  ws://localhost:6499/debug
Inspect in browser:
  https://debug.bun.sh/#localhost:6499/debug
--------------------- Bun Inspector ---------------------
```

然后 TUI 正常显示，可以输入消息。

> **为什么要用 `--inspect=ws://localhost:6499/debug` 而不是直接 `--inspect`？** 见下方"踩坑记录"。

### 第 2 步：在 VSCode 设断点

打开 `src/tui/agent.tsx`，在你想暂停的地方设断点。比如：

- `handleSubmit` 函数里的 `const text = textarea?.plainText?.trim()` — 看用户输入了什么
- `onChunk` 回调里的 `setMessages(...)` — 看流式文本怎么追加
- `runAgentLoop` 调用处 — 看 agent loop 怎么启动

### 第 3 步：F5 attach

按 `F5`，选 **"Attach 到外部终端"**。对应的 launch.json 配置：

```json
{
  "type": "bun",
  "request": "attach",
  "name": "Attach 到外部终端",
  "url": "ws://localhost:6499/debug",
  "cwd": "${workspaceFolder}"
}
```

VSCode 连上 `ws://localhost:6499/debug` 后，调试器状态栏变橙色（已连接）。

### 第 4 步：操作 TUI，断点命中

回到外部终端，输入消息按 Enter。当代码执行到你设断点的行时，VSCode 会暂停程序：

- **Variables** 面板：看 `text`、`messages`、`loading` 等变量值
- **Call Stack** 面板：看调用链（谁调了 `handleSubmit`）
- **F10**（Step Over）：一步一步走，看 `setMessages` 怎么更新状态
- **F5**（Continue）：继续运行，等下一个断点

## 踩坑记录：404 错误

### 现象

F5 attach 后报错：

```
Unexpected server response: 404
```

### 原因

Bun 的 inspector 默认生成**随机 session ID** 作为 WebSocket 路径：

```
ws://localhost:6499/mfaylgcyw    ← 这个 mfaylgcyw 每次都变
```

而 Bun VSCode 扩展的 attach 是**直连你写的 URL**，不做任何自动发现。如果 launch.json 里写的是：

```json
"url": "ws://localhost:6499"       ← 没有路径
```

扩展会连到 `ws://localhost:6499/`，但 inspector 只在 `/mfaylgcyw` 这个路径上接受 WebSocket 连接，根路径 `/` 返回 404。

### 为什么不能用 `/json` 自动发现？

标准的 Chrome DevTools Protocol 会提供一个 HTTP 发现接口：

```
GET http://localhost:6499/json    → 返回所有调试目标的 WebSocket URL
```

但 Bun 1.3.13 的 inspector **没有实现这个接口**（`/json` 返回空，只有 `/json/version` 能用）。所以扩展没法自动发现 URL。

### 解决方案：指定固定路径

`--inspect` 可以接收完整的 WebSocket URL 作为参数：

```bash
bun --inspect=ws://localhost:6499/debug src/tui/agent.tsx
```

这样 Bun 的 inspector 就监听在**固定路径** `/debug` 上，不再随机。launch.json 里写死同样的 URL，每次 attach 都能连上。

> 对照 opencode：它的 [`.vscode/launch.example.json`](../../../opencode/.vscode/launch.example.json) 用的是 `ws://localhost:6499/`（根路径）。这可能依赖不同版本的 Bun 行为，或者 opencode 开发者手动用 `BUN_INSPECT` 环境变量控制了 URL。我们用固定路径 `/debug` 更可靠。

## 三个 inspect flag

`--inspect` 有三个变体，区别在于"什么时候开始执行代码"：

| flag | 行为 | 适用场景 |
|------|------|---------|
| `--inspect` | 立即执行，同时开 inspector | TUI 长跑，随时 attach |
| `--inspect-wait` | 开 inspector，**等 VSCode 连上才开始执行** | 想断在启动阶段 |
| `--inspect-brk` | 第一行就断，等连上 | 调初始化逻辑 |

对于 TUI 程序，通常用 `--inspect`（方法一）就够了——TUI 是事件循环，会一直跑，你随时 attach 都行，断点会在下一次执行到时命中。

如果你想调试 `render()` 之前的初始化代码，用 `--inspect-wait`：

```bash
bun --inspect-wait=ws://localhost:6499/debug src/tui/agent.tsx
```

程序会卡住等 VSCode 连上，连上后才开始执行。这样启动阶段的断点也能命中。

## 备用方法：Bun.debugger()

如果不想配置 launch.json，还有个更简单的招：在代码里直接写一行：

```ts
import { handleSubmit } from "./somewhere"

async function handleSubmit() {
  Bun.debugger()    // ← 执行到这行会暂停（如果调试器已连接）
  const text = textarea?.plainText?.trim()
  // ...
}
```

`Bun.debugger()` 类似 Python 的 `breakpoint()`——执行到这行时，如果 VSCode 调试器已经连上，程序暂停；如果没连上，这行被忽略，不影响运行。

**用法**：

1. 先用 `bun --inspect=ws://localhost:6499/debug src/tui/agent.tsx` 启动
2. VSCode F5 attach 上去
3. 在外部终端操作 TUI，代码跑到 `Bun.debugger()` 那行就暂停

适合"我知道大概在哪出问题，想精确停在那"的场景。调试完记得删掉这行。

## 实操：调试 onChunk 回调

以 `agent.tsx` 的流式文本回调为例，用断点看清 SolidJS signal 怎么一步步更新。

### 设断点

在 `src/tui/agent.tsx` 的 `onChunk` 回调里设断点：

```tsx
onChunk(chunk) {
  setMessages((prev) => {
    const last = prev[prev.length - 1]!    // ← 在这行设断点
    if (last.role !== "assistant") {
      return [...prev, { role: "assistant", content: chunk }]
    }
    return [
      ...prev.slice(0, -1),
      { ...last, content: last.content + chunk },
    ]
  })
}
```

### 调试过程

1. 外部终端：`bun run tui:debug`
2. VSCode：F5 选 "Attach 到外部终端"
3. 外部终端：输入 "你好"，按 Enter
4. LLM 开始返回文本，第一个 chunk 到达时断点命中

在 **Variables** 面板里能看到：

| 变量 | 值 | 说明 |
|------|-----|------|
| `chunk` | `"你"` | LLM 返回的第一个文本片段 |
| `prev` | `[{role:"assistant",...}, {role:"user",...}]` | 当前的消息列表 |
| `last` | `{role:"user", content:"你好"}` | 最后一条消息 |
| `last.role` | `"user"` | 不是 assistant，所以会走新建分支 |

按 `F10`（Step Over）一步步走，能看到：
- `last.role !== "assistant"` 为 `true`，进入 if 分支
- 返回 `[...prev, { role: "assistant", content: "你" }]`，新建了一条 assistant 消息
- `setMessages` 触发 SolidJS 重渲染，TUI 上出现 "AI: 你"

按 `F5`（Continue），等下一个 chunk。第二个 chunk `"好"` 到达时，断点再次命中：
- `last` 变成了 `{role:"assistant", content:"你"}`
- `last.role !== "assistant"` 为 `false`，走 else 分支
- 返回追加后的消息：`{role:"assistant", content:"你好"}`

这样就看清了"第一次 chunk 新建消息、后续 chunk 追加内容"的逻辑。

## 本课小结

1. **TUI 调试的核心难点**：opentui 开 raw mode 接管键盘，调试控制台不是真 TTY，交互式 TUI 必须用外部终端
2. **launch 模式**：非交互 TUI（如 `hello.tsx`）直接用，和阶段 0 学的一样
3. **attach 模式**：交互式 TUI（如 `agent.tsx`）的必选方案——外部终端跑 TUI，VSCode 通过 WebSocket 连上
4. **固定路径 trick**：`--inspect=ws://localhost:6499/debug` 指定固定路径，避免随机 session ID 导致 404
5. **三个 flag**：`--inspect`（立即执行）、`--inspect-wait`（等连上再执行）、`--inspect-brk`（第一行就断）
6. **Bun.debugger()**：代码里写一行，执行到就暂停，类似 Python 的 `breakpoint()`

> 对照 opencode：opencode 的 TUI 和 agent 是两个进程（TUI 通过 HTTP/SSE 连 server，server 连 agent），所以 opencode 开发者调试时，TUI 和 agent 可以分别用不同的 debug 配置。我们是单进程，一个 attach 就够了。等阶段 10 拆分成多进程后，调试方式也要相应演进。
