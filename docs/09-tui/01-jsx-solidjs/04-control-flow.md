# 9.1 控制流组件：Show 和 For

> 本课目标：学会用 `<Show>` 做条件渲染、`<For>` 做列表渲染，理解为什么不直接用 `if` 和 `.map()`。

## 为什么需要控制流组件

在普通 TypeScript 里，条件用 `if`/`else`，循环用 `for`/`while`。但在 JSX 里，你不能在标签内部直接写 `if` 语句：

```tsx
// ❌ 不行：JSX 的 {} 里只能放表达式，不能放语句
<text>
  {
    if (count() > 0) {
      "正数"
    } else {
      "非正数"
    }
  }
</text>
// 语法错误！if 是语句，不是表达式
```

> Python 类比：Python 有三元表达式 `x if condition else y`，也有列表推导 `[f(x) for x in list]`。TypeScript 有三元表达式 `condition ? a : b`，但 JSX 里用它做条件渲染有性能问题（后面解释）。所以 SolidJS 提供了专门的组件。

## `<Show>`：条件渲染

`<Show>` 组件根据条件决定是否渲染子元素。

### 基本用法

```tsx
import { Show } from "solid-js"
import { createSignal } from "solid-js"

const [isLoggedIn, setIsLoggedIn] = createSignal(false)

// when 为 true -> 渲染子元素
// when 为 false -> 不渲染
<Show when={isLoggedIn()}>
  <text>欢迎回来！</text>
</Show>
// isLoggedIn() = false -> 什么都不显示
// setIsLoggedIn(true)  -> 显示 "欢迎回来！"
```

### 带 fallback（否则显示）

```tsx
<Show when={isLoggedIn()} fallback={<text>请登录</text>}>
  <text>欢迎回来！</text>
</Show>
// isLoggedIn() = false -> 显示 "请登录"（fallback）
// isLoggedIn() = true  -> 显示 "欢迎回来！"
```

### 为什么不用三元表达式

你可能会想：JSX 的 `{}` 里可以放三元表达式，为什么不直接用？

```tsx
// 方法 1：三元表达式
{count() > 0 ? <text>正数</text> : <text>非正数</text>}

// 方法 2：<Show>
<Show when={count() > 0} fallback={<text>非正数</text>}>
  <text>正数</text>
</Show>
```

功能上一样，但 `<Show>` 的优势在于**响应式追踪更精确**：

- **三元表达式**：`count()` 变了，整个表达式重新求值，两边的 `<text>` 都被重新创建
- **`<Show>`**：`count()` 变了，只在 true/false 切换时创建/销毁子元素。值没变（还是 true），子元素不会被重新创建

简单场景看不出差别。但当子元素很复杂（比如一个包含很多内容的消息组件），`<Show>` 避免了不必要的重新创建，性能更好。

> **初学建议**：先统一用 `<Show>`，不用纠结什么时候用三元。养成习惯后，简单的文字插值可以用三元，复杂的条件渲染用 `<Show>`。

## `<For>`：列表渲染

`<For>` 组件遍历数组，为每个元素渲染子内容。

### 基本用法

```tsx
import { For } from "solid-js"
import { createSignal } from "solid-js"

const [fruits, setFruits] = createSignal(["苹果", "香蕉", "橘子"])

<For each={fruits()}>
  {(fruit) => <text>{fruit}</text>}
</For>
// 渲染：
// 苹果
// 香蕉
// 橘子
```

### 逐行解释

```tsx
<For each={fruits()}>       // each：要遍历的数组
  {(fruit) =>              // 回调函数：接收每个元素
    <text>{fruit}</text>   // 返回这个元素对应的 JSX
  }
</For>
```

`<For>` 的子元素是一个**函数**，不是 JSX。这个函数接收数组的一个元素，返回对应的 JSX。`<For>` 对每个元素调用这个函数，把结果拼在一起。

> Python 类比：
> ```python
> # Python 列表推导
> [f"<text>{fruit}</text>" for fruit in fruits]
>
> # <For> 的等价写法
> fruits.map(fruit => <text>{fruit}</text>)
> ```
> 但 `<For>` 比 `.map()` 做了更多优化（后面解释）。

### 带索引

```tsx
const [messages] = createSignal([
  { role: "user", content: "你好" },
  { role: "assistant", content: "你好！" },
  { role: "user", content: "再见" },
])

<For each={messages()}>
  {(msg, index) => (
    <text>[{index()}] {msg.role}: {msg.content}</text>
  )}
</For>
// 渲染：
// [0] user: 你好
// [1] assistant: 你好！
// [2] user: 再见
```

回调函数可以接收第二个参数 `index`，它是当前元素的索引（也是函数，调用 `index()` 拿到数字）。

### 遍历对象数组

更实际的例子--渲染消息列表：

```tsx
const [messages, setMessages] = createSignal([
  { role: "user", content: "帮我读一下 src/index.ts" },
  { role: "assistant", content: "好的，我来读取文件..." },
])

<For each={messages()}>
  {(msg) => (
    <box flexDirection="column">
      <text color="cyan">{msg.role}:</text>
      <text>{msg.content}</text>
    </box>
  )}
</For>
// 渲染：
// user:
// 帮我读一下 src/index.ts
// assistant:
// 好的，我来读取文件...
```

### 为什么不用 `.map()`

```tsx
// 方法 1：.map()
{messages().map(msg => <text>{msg.content}</text>)}

// 方法 2：<For>
<For each={messages()}>
  {(msg) => <text>{msg.content}</text>}
</For>
```

功能上一样，但 `<For>` 的优势在于**更新效率**：

- **`.map()`**：数组变了（比如追加一条消息），整个列表重新创建。10 条消息 -> 只加了 1 条 -> 10 条全重新创建
- **`<For>`**：按 key 追踪每个元素。10 条消息 -> 加了 1 条 -> 只创建新的 1 条，原来的 10 条不动

> **SolidJS 的 `<For>` 默认用数组索引作为 key**。当数组变化时，它只更新变化的部分。这在消息列表场景特别重要--流式输出时消息不断追加，不能每次都重建整个列表。

### 动态添加元素

```tsx
const [messages, setMessages] = createSignal<string[]>([])

// 初始：空列表
<For each={messages()}>
  {(msg) => <text>{msg}</text>}
</For>
// 什么都不显示

// 添加一条
setMessages([...messages(), "第一条"])
// 显示: 第一条
// <For> 只创建新的 <text>，不影响已有的

// 再添加一条
setMessages([...messages(), "第二条"])
// 显示: 第一条
//       第二条
// <For> 只创建 "第二条" 的 <text>，"第一条" 原地不动
```

## 组合使用

`<Show>` 和 `<For>` 可以组合：

```tsx
const [messages] = createSignal([
  { role: "user", content: "你好" },
  { role: "assistant", content: "" },  // 空内容
  { role: "user", content: "再见" },
])

<For each={messages()}>
  {(msg) => (
    <Show when={msg.content.length > 0} fallback={<text color="gray">（空消息）</text>}>
      <text>{msg.role}: {msg.content}</text>
    </Show>
  )}
</For>
// 渲染：
// user: 你好
// （空消息）
// user: 再见
```

`<For>` 遍历每条消息，`<Show>` 判断内容是否为空--为空显示"（空消息）"，不为空显示正常内容。

## 完整示例：响应式消息列表

把三件套（signal、memo、effect）和控制流（Show、For）组合起来：

```tsx
import { createSignal, createMemo, createEffect, Show, For } from "solid-js"

function ChatApp() {
  // 数据源：消息列表
  const [messages, setMessages] = createSignal<{role: string, content: string}[]>([])

  // 计算属性：消息数量
  const messageCount = createMemo(() => messages().length)

  // 计算属性：是否有消息
  const hasMessages = createMemo(() => messages().length > 0)

  // 模拟添加消息
  function addMessage(role: string, content: string) {
    setMessages([...messages(), { role, content }])
  }

  // 副作用：消息数量变了，打印日志
  createEffect(() => {
    console.log(`当前有 ${messageCount()} 条消息`)
  })

  return (
    <box flexDirection="column">
      {/* 条件渲染：有消息才显示列表 */}
      <Show when={hasMessages()} fallback={<text color="gray">暂无消息</text>}>
        <text>消息列表（共 {messageCount()} 条）：</text>

        {/* 列表渲染：遍历消息 */}
        <For each={messages()}>
          {(msg) => (
            <text color={msg.role === "user" ? "cyan" : "green"}>
              {msg.role}: {msg.content}
            </text>
          )}
        </For>
      </Show>
    </box>
  )
}

// 调用：
// addMessage("user", "你好")     -> 打印 "当前有 1 条消息"，UI 显示消息
// addMessage("assistant", "你好！") -> 打印 "当前有 2 条消息"，UI 新增一条
```

这个例子用了全部概念：
- `createSignal`：messages（数据源）
- `createMemo`：messageCount、hasMessages（计算属性）
- `createEffect`：打印日志（副作用）
- `<Show>`：有消息才显示列表，没有显示"暂无消息"
- `<For>`：遍历消息列表

下一课我们把这个渲染到终端屏幕上。

## 本课小结

1. **`<Show when={条件}>`**：条件为 true 渲染子元素，false 不渲染。`fallback` 指定 else 内容
2. **`<For each={数组}>`**：遍历数组，回调函数返回每个元素的 JSX。回调接收 `(元素, 索引)`
3. **不用 `if` 和 `.map()`**：JSX 里不能写 `if` 语句；`.map()` 每次重建所有元素，`<For>` 只更新变化的部分
4. **`<Show>` vs 三元**：`<Show>` 更精确地控制创建/销毁，复杂子元素时性能更好
5. **`<For>` vs `.map()`**：`<For>` 按 key 追踪，追加元素时只创建新的，不重建旧的
6. **组合使用**：`<For>` 里可以嵌套 `<Show>`，`<Show>` 里可以嵌套 `<For>`

下一步：[9.2 opentui 终端渲染](../02-opentui-render/) -- 把 JSX + SolidJS 渲染到终端。
