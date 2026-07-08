# 9.1 SolidJS 响应式三件套

> 本课目标：学会 SolidJS 的三个核心 API--createSignal、createMemo、createEffect，理解它们怎么实现"数据变了 UI 自动更新"。

## 回顾：响应式的核心思想

上一课我们说了：响应式 = 你声明数据和 UI 的关系，数据变了 UI 自动更新。

问题是：**框架怎么知道"谁依赖谁"？** 数据变了，框架怎么知道该更新哪些地方？

SolidJS 的答案：**用函数追踪**。当你读取一个 signal 的值时，SolidJS 记住"这个地方依赖这个 signal"。当 signal 变了，SolidJS 找到所有依赖它的地方，自动更新。

下面看三件套怎么实现这个机制。

## 1. createSignal：响应式变量

`createSignal` 创建一个响应式变量--这是数据源。

### 基本用法

```tsx
import { createSignal } from "solid-js"

// createSignal(初始值) 返回一个数组：[读取函数, 设置函数]
const [count, setCount] = createSignal(0)
//         ↑              ↑
//         读取函数        设置函数
//         调用 count()    调用 setCount(新值)
//         返回当前值      更新值并通知依赖
```

### 读取值：调用函数

```tsx
// count 是函数，不是变量！要调用才能拿到值
console.log(count())  // 0

// ❌ 错误：count 是函数，不是值
// console.log(count)  // 打印出函数本身，不是 0
```

### 设置值：调用 set 函数

```tsx
// 直接设置新值
setCount(5)
console.log(count())  // 5

// 基于当前值计算新值（类似 count += 1）
setCount(c => c + 1)
console.log(count())  // 6
```

### 为什么是函数而不是变量？

这是 SolidJS 最容易困惑的点。为什么不设计成 `let count = 0` 然后 `count = 5`？

因为 **SolidJS 需要知道你在哪里读取了这个值**。只有追踪到读取位置，才能在值变化时精确更新那个位置。

```tsx
const [count, setCount] = createSignal(0)

function MyComponent() {
  return (
    <text>{count()}</text>
    //         ↑
    //    这里调用了 count()
    //    SolidJS 记住：<text> 依赖 count
  )
}

// 当 setCount(5) 被调用时：
// 1. SolidJS 查找谁依赖 count
// 2. 找到 <text> 依赖它
// 3. 重新渲染 <text>，显示新值 5
```

如果 `count` 是普通变量，`<text>{count}</text>` 只是读取了值，SolidJS 没法知道"这里依赖 count"。函数调用 `count()` 就是一个"钩子"--SolidJS 在这里埋点，记录依赖关系。

> Python 类比：这类似 Python 的 `@property`。读取 `obj.count` 时触发 getter，SolidJS 在 getter 里记录"有人读了我"。但 Python 的 property 看起来像变量访问，SolidJS 用函数调用让"这里在读响应式数据"更明确。

### 完整示例

```tsx
import { createSignal } from "solid-js"

const [name, setName] = createSignal("世界")
const [count, setCount] = createSignal(0)

// 读取
console.log(name())   // "世界"
console.log(count())  // 0

// 设置
setName("Alice")
setCount(42)

console.log(name())   // "Alice"
console.log(count())  // 42

// 基于当前值更新
setCount(c => c + 1)  // 43
setCount(c => c * 2)  // 86
```

> **给 Python 程序员的提示**：`createSignal` 返回的 `[count, setCount]` 是 TypeScript 的**解构赋值**，类似 Python 的 `count, set_count = create_signal(0)`。`createSignal` 返回一个有两个元素的数组，解构出读取函数和设置函数。

## 2. createMemo：计算属性

`createMemo` 创建一个**基于其他 signal 的计算值**。它依赖的 signal 变了，才重新计算；没变就用缓存的旧结果。

### 为什么需要 createMemo

```tsx
const [count, setCount] = createSignal(5)

// 不用 memo：每次读取都重新计算
const doubled = () => count() * 2  // 普通函数
console.log(doubled())  // 10（每次调用都计算）
console.log(doubled())  // 10（又算了一遍）

// 用 memo：结果被缓存
const doubledMemo = createMemo(() => count() * 2)
console.log(doubledMemo())  // 10（第一次计算）
console.log(doubledMemo())  // 10（直接用缓存，不重新计算）

setCount(6)
console.log(doubledMemo())  // 12（count 变了，重新计算）
console.log(doubledMemo())  // 12（又用缓存了）
```

### createMemo 的特点

1. **自动追踪依赖**：memo 函数里读了哪些 signal，就依赖哪些。`() => count() * 2` 读了 `count`，所以依赖 `count`
2. **缓存结果**：依赖没变时，重复读取直接返回缓存，不重新计算
3. **依赖变了才重算**：`count` 变了，memo 自动重新计算

> Python 类比：`createMemo` 类似 Python 的 `@cached_property`--第一次访问时计算，之后缓存结果。区别是 SolidJS 的 memo 在依赖变了时会自动失效缓存、重新计算。

### 什么时候用 createMemo

- **计算量大的场景**：比如过滤一个大列表，不想每次渲染都重算
- **依赖多个 signal**：`createMemo(() => `${firstName()} ${lastName()}`)` 拼接全名

简单计算（如 `count() * 2`）其实不用 memo 也行--memo 主要是优化性能。初学时可以先用普通函数，觉得性能有问题再换 memo。

## 3. createEffect：副作用

`createEffect` 创建一个**自动执行的副作用**--它依赖的 signal 变了，就自动重新执行。

### 什么是"副作用"

"副作用"（side effect）是指**改变外部状态**的操作，比如：
- 打印到控制台（`console.log`）
- 写文件
- 发网络请求
- 修改其他 signal

> Python 类比：纯函数（没有副作用）只计算返回值，不改变外部世界。副作用就是"除了返回值之外，还对外界做了什么"。

### 基本用法

```tsx
import { createSignal, createEffect } from "solid-js"

const [count, setCount] = createSignal(0)

// createEffect 接收一个函数
// 函数里读了 count()，所以这个 effect 依赖 count
// count 变了，这个函数会自动重新执行
createEffect(() => {
  console.log(`count 的值是: ${count()}`)
})

// 执行 setCount，effect 自动重新跑
setCount(1)  // 控制台打印: count 的值是: 1
setCount(2)  // 控制台打印: count 的值是: 2
setCount(3)  // 控制台打印: count 的值是: 3
```

### 执行时机

1. **首次执行**：`createEffect` 被调用时立即执行一次
2. **后续执行**：依赖的 signal 变了，自动重新执行

```tsx
const [count, setCount] = createSignal(0)

createEffect(() => {
  console.log(`执行了，count = ${count()}`)
})
// 立即打印: 执行了，count = 0（首次执行）

setCount(5)
// 打印: 执行了，count = 5（依赖变了，重新执行）

setCount(5)
// 不打印！值没变（5 -> 5），SolidJS 不触发重新执行
```

### createEffect vs createMemo

| | createMemo | createEffect |
|---|-----------|--------------|
| 返回值 | 有（计算结果） | 无 |
| 用途 | 计算并缓存值 | 执行副作用 |
| 何时执行 | 被读取时（可能用缓存） | 依赖变了时（自动执行） |
| 类比 | `@cached_property` | setter + observer |

简单记忆：
- **要计算一个值** -> `createMemo`
- **要执行一个动作**（打印、写文件、发请求）-> `createEffect`

### 什么时候用 createEffect

典型场景：
- 数据变了，自动保存到数据库
- 数据变了，自动打印日志
- 组件加载时，自动发请求获取数据

```tsx
// 场景：count 变了，自动保存到文件
const [count, setCount] = createSignal(0)

createEffect(() => {
  // count 变了 -> 自动执行这个函数 -> 自动保存
  Bun.write("count.txt", String(count()))
})

setCount(5)  // 自动写入 "5" 到 count.txt
setCount(10) // 自动写入 "10" 到 count.txt
```

## 三件套的关系

```
createSignal（数据源）
    │
    │ 读取 signal()
    │
    ├──> createMemo（计算属性）
    │       依赖 signal，signal 变了自动重算
    │       返回计算结果（缓存）
    │
    └──> createEffect（副作用）
            依赖 signal，signal 变了自动执行
            执行副作用（不返回值）
```

核心思路：**声明数据关系，不手动控制执行顺序**。

1. `createSignal` 创建数据源
2. `createMemo` 声明"这个值依赖哪些 signal"
3. `createEffect` 声明"signal 变了要做这些事"
4. signal 变了 -> memo 自动重算 -> effect 自动执行 -> UI 自动更新

**你不用写"if count 变了 then do X"这样的逻辑**--SolidJS 自动追踪依赖、自动触发更新。

## 本课小结

1. **createSignal**：创建响应式变量（数据源）。返回 `[读取函数, 设置函数]`。读取时调用函数 `count()`，设置时调用 `setCount(新值)`
2. **createMemo**：创建计算属性。依赖的 signal 变了才重新计算，结果被缓存
3. **createEffect**：创建副作用。依赖的 signal 变了自动重新执行
4. **追踪机制**：在函数里读 `signal()` 时，SolidJS 记录依赖关系。signal 变了，所有依赖它的地方自动更新
5. **不用手动控制更新**：声明关系，框架自动触发

下一步：[9.1 控制流组件](./04-control-flow.md) -- `<Show>` 和 `<For>`，条件渲染和列表渲染。
