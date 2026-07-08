# 9.2 opentui 终端渲染：第一个 TUI

> 本课目标：跑出你的第一个 TUI 程序——一个每秒自动 +1 的计数器。学会 `render()` 挂载组件、`<box>` / `<text>` 终端元素、以及 SolidJS 响应式在终端里怎么更新。

## 先看效果

```bash
bun run tui
```

你会看到终端全屏，显示：

```
 opentui 计数器
 计数: 0
```

数字每秒 +1（0 → 1 → 2 → 3 ...），按 Ctrl+C 退出。

## 前提：bunfig.toml

在写代码之前，先做一件事：创建 `bunfig.toml`。

### 为什么

Bun 运行 `.tsx` 文件时，默认用自己的方式编译 JSX。但 SolidJS 需要**自己的编译方式**——它要把 `<text>计数: {count()}</text>` 里的 `{count()}` 编译成响应式代码，让 `count()` 变化时自动更新 UI。

`@opentui/solid` 包里有一个 Bun 插件来做这个编译。需要告诉 Bun 加载它。

### 怎么做

在项目根目录创建 `bunfig.toml`（Bun 的配置文件）：

```toml
preload = ["./node_modules/@opentui/solid/scripts/preload.js"]
```

`preload` 表示：**每次 Bun 启动时，先加载这个脚本**。脚本里注册了 SolidJS 的 JSX 编译插件。

> 注意：`preload` 接受的是文件路径，不是 npm 包名。不能写成 `"@opentui/solid/preload"`。

### 怎么验证

如果忘了配 `bunfig.toml`，程序能跑起来但**计数器永远显示 0**——因为 `{count()}` 没有被编译成响应式代码，`count` 变了 UI 不刷新。配了之后，`{count()}` 被正确编译，`count` 变了 UI 自动更新。

> 对照 opencode：它的 TUI 是通过 CLI 命令启动的，插件在 CLI 内部动态加载了。我们直接跑 `.tsx` 文件，所以需要 bunfig.toml。

## 写代码

代码在 `src/tui/hello.tsx`。从头写。

### 1. 导入

```tsx
import { render } from "@opentui/solid"
import { createSignal } from "solid-js"
```

- `render` 来自 `@opentui/solid`：把组件挂载到终端
- `createSignal` 来自 `solid-js`：创建响应式变量（9.1 课学的）

### 2. 写组件

```tsx
function App() {
  const [count, setCount] = createSignal(0)

  // 每秒 +1
  setInterval(() => setCount((c) => c + 1), 1000)

  return (
    <box flexDirection="column" padding={1}>
      <text fg="green">opentui 计数器</text>
      <text fg="cyan">计数: {count()}</text>
    </box>
  )
}
```

逐行解释：

- `const [count, setCount] = createSignal(0)`：创建响应式变量 `count`，初始值为 0
- `setInterval(() => setCount((c) => c + 1), 1000)`：每秒把 `count` 加 1
- `<box flexDirection="column" padding={1}>`：一个纵向排列的容器，四周留 1 个字符的空白
- `<text fg="green">`：绿色文字，显示静态标题
- `<text fg="cyan">计数: {count()}</text>`：青色文字，`{count()}` 是动态内容，`count` 变了这里自动更新

### 3. 挂载到终端

```tsx
render(() => <App />)
```

`render` 接收一个函数，函数返回根组件。SolidJS 从这里开始追踪响应式依赖——`count` 变了，`{count()}` 自动更新，opentui 自动重绘终端。

### 完整代码

```tsx
// src/tui/hello.tsx
import { render } from "@opentui/solid"
import { createSignal } from "solid-js"

function App() {
  const [count, setCount] = createSignal(0)

  setInterval(() => setCount((c) => c + 1), 1000)

  return (
    <box flexDirection="column" padding={1}>
      <text fg="green">opentui 计数器</text>
      <text fg="cyan">计数: {count()}</text>
    </box>
  )
}

render(() => <App />)
```

## 运行

```bash
bun run src/tui/hello.tsx
```

或者在 `package.json` 里加了快捷 script 后：

```bash
bun run tui
```

按 Ctrl+C 退出。

## 它是怎么工作的

```
setInterval 每秒触发
    │
    ▼
setCount((c) => c + 1)     ← count 从 0 变成 1
    │
    ▼
SolidJS 检测到 count 变了
    │
    ▼
重新计算 {count()}          ← 计算出 "计数: 1"
    │
    ▼
opentui 重绘终端            ← 屏幕上显示 "计数: 1"
```

关键：**你只写了 `setCount`，没写任何"更新显示"的代码**。SolidJS 自动追踪谁依赖 `count`（就是 `<text>` 里的 `{count()}`），自动更新。opentui 负责把更新画到终端。

## opentui 终端元素详解

上面用了 `<box>` 和 `<text>`。下面逐个展开。

### `<box>`：容器

类似 HTML 的 `<div>`——用来分组、布局。

```tsx
<box flexDirection="column" padding={1} flexGrow={1}>
  <text>里面的内容</text>
</box>
```

| 属性 | 类型 | 作用 |
|------|------|------|
| `flexDirection` | `"column"` \| `"row"` | 子元素排列方向：纵向 / 横向 |
| `padding` | number | 四周内边距（字符数） |
| `paddingLeft` | number | 左侧内边距 |
| `paddingTop` | number | 顶部内边距 |
| `flexGrow` | number | 占用剩余空间的比例（1 = 撑满可用空间） |
| `width` | number \| string | 宽度（`80` = 80 字符，`"100%"` = 占满） |
| `height` | number \| string | 高度 |
| `backgroundColor` | string | 背景色 |

> Python 类比：`<box>` 类似 `rich` 库的 `rich.layout.Layout`——一个可以放内容的容器，控制布局方向、间距、大小。

### `<text>`：文本

显示文字，可以设置颜色。

```tsx
<text fg="green">绿色文字</text>
<text fg="red">错误信息</text>
<text fg="cyan">计数: {count()}</text>
```

| 属性 | 类型 | 作用 |
|------|------|------|
| `fg` | string | 文字颜色：`"green"`、`"red"`、`"cyan"`、`"yellow"`、`"gray"`、`"white"` 等 |
| `backgroundColor` | string | 背景色 |
| `wrapMode` | `"word"` \| `"none"` | 换行模式：自动换行 / 不换行 |

### `<scrollbox>`：滚动区

内容超出屏幕时自动出现滚动条。消息列表要用它。

```tsx
<scrollbox flexGrow={1} stickyScroll={true}>
  <For each={messages()}>
    {(msg) => <text>{msg.content}</text>}
  </For>
</scrollbox>
```

| 属性 | 类型 | 作用 |
|------|------|------|
| `flexGrow` | number | 撑满可用空间 |
| `stickyScroll` | boolean | 新内容出现时自动滚到底部（像聊天软件） |

## 布局示例：聊天界面骨架

用三个 `<box>` 纵向排列，模拟一个聊天界面：

```tsx
<box flexDirection="column" height="100%">
  {/* 顶部标题栏 */}
  <box padding={1}>
    <text fg="green">AI 助手</text>
  </box>

  {/* 中间消息列表，占满剩余空间 */}
  <scrollbox flexGrow={1}>
    <text>user: 你好</text>
    <text>assistant: 你好！</text>
  </scrollbox>

  {/* 底部输入区 */}
  <box padding={1}>
    <text fg="gray">输入消息...</text>
  </box>
</box>
```

渲染效果：

```
 AI 助手
────────────────────
user: 你好
assistant: 你好！
────────────────────
 输入消息...
```

`flexDirection="column"` 让三个区域纵向排列。`flexGrow={1}` 让消息列表占满中间空间，标题栏和输入区只占自己需要的高度。

## 对照 opencode

opencode 的 TUI 入口在 `packages/tui/src/app.tsx`：

```tsx
// opencode 的 render 调用（简化）
import { render } from "@opentui/solid"
import { createCliRenderer } from "@opentui/core"

const renderer = createCliRenderer({ targetFps: 60, exitOnCtrlC: false })

render(() => (
  <ExitProvider>
    <SdkProvider>
      <SyncProvider>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </SyncProvider>
    </SdkProvider>
  </ExitProvider>
), renderer)
```

和我们的 `render(() => <App />)` 本质上一样，区别是：
- 包了多层 Provider（依赖注入，类似 Python 的 Context 传递）
- 用了 `createCliRenderer` 自定义渲染器（60fps、Ctrl+C 处理）
- 我们简化版用默认渲染器，够用

## 本课小结

1. **bunfig.toml**：配置 Bun 预加载 SolidJS 的 JSX 编译插件，没有它响应式不生效
2. **`render(() => <App />)`**：把组件挂载到终端，启动响应式追踪
3. **`<box>`**：容器，控制布局（flexDirection、padding、flexGrow）
4. **`<text>`**：文字，控制颜色（fg）
5. **`<scrollbox>`**：可滚动区域，`stickyScroll` 自动滚到底部
6. **响应式更新流程**：`setCount` → SolidJS 追踪依赖 → 重算 `{count()}` → opentui 重绘

下一步：[9.3 消息流渲染](../03-message-render/) —— 渲染消息列表 + 流式文本。