# 9.1 什么是响应式编程

> 本课目标：理解"响应式编程"这个概念，知道它和我们之前写代码的方式有什么不同。
>
> 你从来没做过前端开发，没关系--这个概念对前端新人也是新东西。我们从零开始。

## 先回顾：我们之前怎么写代码

到目前为止，我们写的所有代码都是**命令式**的--明确告诉计算机每一步做什么，按顺序执行：

```ts
// 命令式：一步一步手动控制

// 第 1 步：打印提示
process.stdout.write("AI: ")

// 第 2 步：调 LLM，等结果
const result = await provider.chatWithTools(messages, tools, (text) => {
  // 第 3 步：每收到一段文本，手动打印
  process.stdout.write(text)
})

// 第 4 步：把结果存到 messages 数组
messages.push({ role: "assistant", content: result.text })

// 第 5 步：手动存数据库
await saveMessage(sessionId, assistantMsg)
```

这种方式的特点：
- **你控制执行顺序**：第 1 步、第 2 步、第 3 步...按顺序跑
- **你手动更新显示**：数据变了，你手动调 `process.stdout.write` 或 `console.log`
- **数据流向是线性的**：输入 -> 处理 -> 输出

## 命令式的痛点

想象你要做一个终端聊天界面，需要同时显示：
- 消息列表（用户消息 + AI 回复）
- 输入框（用户正在打字）
- 状态栏（当前 model、session 信息）

用命令式写，每当数据变了，你得手动更新所有相关的显示：

```ts
// 命令式：数据变了，手动更新显示
function addUserMessage(text: string) {
  messages.push({ role: "user", content: text })
  // 手动更新消息列表显示
  renderMessageList()
  // 手动更新状态栏（未读数变了）
  renderStatusBar()
  // 手动清空输入框
  clearInput()
}

function addAssistantMessage(text: string) {
  messages.push({ role: "assistant", content: text })
  // 又要手动更新...
  renderMessageList()
  renderStatusBar()
}
```

痛点在于：**每个改变数据的地方，都得记得手动更新显示**。忘了调 `renderMessageList()`，界面就不更新。数据源多了，手动维护更新逻辑容易漏。

## 响应式：数据变了，UI 自动更新

响应式编程的思路：**你声明 UI 和数据的关系，数据变了 UI 自动更新，你不用手动刷新**。

用 Excel 来理解：

```
Excel 表格：
  A1: 5        ← 你输入的值
  B1: 10       ← 你输入的值
  C1: =A1+B1   ← 你声明的关系（C1 依赖 A1 和 B1）
```

你不用手动重新计算 C1。改了 A1，C1 **自动更新**。Excel 帮你追踪了"C1 依赖 A1 和 B1"这个关系。

SolidJS 的响应式就是这个思路，应用到 UI 上：

```tsx
// 响应式：声明 UI 和数据的关系
const [count, setCount] = createSignal(0)  // 数据源（类似 Excel 的 A1）

// UI 声明：显示 count 的值（类似 Excel 的 C1 = A1）
return <text>计数: {count()}</text>

// 当 setCount 改变值时：
// -> SolidJS 自动知道 <text> 依赖 count
// -> 自动更新 <text> 的显示
// -> 你不用手动调任何 "render" 函数
setCount(5)  // UI 自动变成 "计数: 5"
```

> 对比命令式：
> ```ts
> // 命令式：数据变了，手动更新
> let count = 0
> console.log(`计数: ${count}`)
> count = 5
> console.log(`计数: ${count}`)  // ← 必须手动重新打印
> ```
>
> ```tsx
> // 响应式：数据变了，自动更新
> const [count, setCount] = createSignal(0)
> // UI 自动显示 count()，不用手动打印
> setCount(5)  // UI 自动更新，不用手动调 render
> ```

## 响应式的核心思想

**你声明关系，框架负责更新。**

不用关心"数据变了之后要更新哪些显示"--框架自动追踪依赖关系，数据一变，所有依赖它的地方自动刷新。

这在前端开发中特别重要，因为 UI 状态多、交互复杂。手动维护"数据变了更新哪里"很容易出错。响应式让你专注于**数据和逻辑**，不用操心**怎么刷新显示**。

> Python 类比：如果你用过 Python 的 `@property`，它就是一种简单的响应式--读取时自动计算，设置时可以触发副作用。SolidJS 把这个概念扩展到了整个 UI 系统。

## 为什么要学这个

我们的 agent 目前用 `prompt()` 读输入、`console.log` 打印输出。这够用，但不够好：
- 没有消息列表--看不到历史对话
- 流式输出就是一串文字往下滚--没有结构
- 工具调用只是 `console.log("[调用工具] read(...)")` -- 不直观

要做更好的终端界面，需要用 UI 框架。opencode 用的是 **opentui/solid**--SolidJS 响应式 + opentui 终端渲染。所以我们需要先学 SolidJS 的响应式概念，下一课再学 opentui 的终端渲染。

## 本课小结

1. **命令式**：手动控制每一步，数据变了手动更新显示
2. **响应式**：声明数据和 UI 的关系，数据变了 UI 自动更新
3. **Excel 类比**：`C1 = A1 + B1`，改了 A1，C1 自动更新--不用手动重新算
4. **为什么需要**：UI 状态多了，手动维护"数据变了更新哪里"容易出错

下一步：[9.1 JSX 语法基础](./02-jsx-basics.md) -- 在 TypeScript 里写 UI 标签。
