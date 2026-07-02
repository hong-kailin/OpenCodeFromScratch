# 0.2 TypeScript 初步：类型系统（对照 Python type hints）

> 本课目标：建立对 TypeScript 类型系统的初步印象，能读懂 opencode 源码里的类型标注。

## 先声明一件事

**本课不是完整的 TypeScript 语言教程。** TypeScript 是一门很大的语言，这里只带你建立初步印象——理解最常见的几种类型写法，能读懂后续课程里出现的代码。

后面章节用到的新 TS 概念/语法（比如 enum、as 断言、条件类型、infer 等），会在用到时随用随讲，不会提前塞给你。

> Python 对照：你学 Python 时也不是先把所有 type hint 语法学完才写代码的。`list[int]`、`Callable[...]`、`TypeVar` 这些都是用到才查的。TS 也一样。

## 类型标注

Python 用 `: 类型` 标注变量，TypeScript 也是 `: 类型`，只是类型名不同：

```ts
// TypeScript
const name: string = "opencode"     // 字符串
const version: number = 1           // 数字（不区分 int/float）
const isReady: boolean = true       // 布尔
const files: string[] = ["a", "b"]  // 数组：string[]（读作"string 数组"）
```

```python
# Python 对照
name: str = "opencode"
version: int = 1                    # Python 还分 int/float，TS 统一是 number
is_ready: bool = True
files: list[str] = ["a", "b"]
```

几个差异记住：

| | Python | TypeScript |
|---|--------|------------|
| 字符串 | `str` | `string` |
| 数字 | `int` / `float` | `number`（统一） |
| 布尔 | `bool` | `boolean` |
| 数组 | `list[str]` | `string[]` |
| 空值 | `None` | `null` / `undefined`（有区别，后续讲） |

> 注意大小写：Python 是 `str`/`bool`（小写），TypeScript 是 `string`/`boolean`（全拼）。这个容易写错。

## 函数类型

函数标注参数类型和返回值类型：

TypeScript 定义函数有三种写法：

```ts
// 写法 1：函数声明（function declaration）
// 类比 Python 的 def，有提升——可以在声明之前调用
function average(a: number, b: number): number {
  return (a + b) / 2
}

// 写法 2：函数表达式（function expression）
// 赋值给变量，不会提升——必须先定义后使用
const average2 = function (a: number, b: number): number {
  return (a + b) / 2
}

// 写法 3：箭头函数（arrow function）
// 也是赋值给变量，opencode 里最常见
const average3 = (a: number, b: number): number => (a + b) / 2
```

```python
# Python 对照：只有 def 和 lambda 两种
def average(a: int, b: int) -> float:      # 类似写法 1
    return (a + b) / 2

average2 = lambda a, b: (a + b) / 2        # 类似写法 3，但 lambda 只能单行
```

三种写法的核心区别：

| | 函数声明 `function foo()` | 函数表达式 `const foo = function()` | 箭头函数 `const foo = () =>` |
|---|---|---|---|
| 提升（声明前可调用） | ✅ 有 | ❌ 没有 | ❌ 没有 |
| 自己的 `this` | ✅ 有（会随调用方式变） | ✅ 有 | ❌ 没有（继承外层） |

> 初学阶段记住：opencode 几乎只用**写法 3（箭头函数）**。写法 1 偶尔出现，写法 2 很少见。看到能认出就行。箭头函数下面单独细讲。

### 箭头函数：为什么要有它

箭头函数的核心作用是**更简洁地定义函数**，同时解决 `this` 绑定的历史痛点。

**1. 更简洁的写法**

```ts
// 普通函数
const greet = function (target: string): string {
  return `hello ${target}`
}

// 箭头函数：省略 function 关键字，=> 连接参数和函数体
const greet = (target: string): string => `hello ${target}`
```

单行表达式可以省略 `return` 和花括号。在 `map`/`filter`/`flatMap` 这种回调场景下优势特别明显：

```ts
const nums = [1, 2, 3]
const doubled = nums.map((n) => n * 2)        // 箭头函数：简洁
const doubled2 = nums.map(function (n) { return n * 2 })  // 普通函数：啰嗦
```

```python
# Python 对照：lambda 是单行匿名函数，类似但更受限
doubled = list(map(lambda n: n * 2, nums))  # lambda 只能单行表达式
```

TS 箭头函数比 Python lambda 强——它可以写完整函数体（多行、多语句），只是单行时写起来特别简洁。

单行用 `=>` 直接跟表达式（自动返回，省略 `return` 和花括号）；多行用花括号 `{}` 包起来，必须显式 `return`：

```ts
// 单行：省略花括号和 return，自动返回表达式结果
const add = (a: number, b: number): number => a + b

// 多行：用花括号包起来，必须显式 return
const average = (a: number, b: number): number => {
  const sum = a + b
  console.log("debug: sum =", sum)
  return sum / 2
}
```

```python
# Python 对照：lambda 只能单行，多行必须用 def
add = lambda a, b: a + b          # 单行

def average(a: int, b: int) -> float:  # 多行只能 def
    sum_ = a + b
    print("debug: sum =", sum_)
    return sum_ / 2
```

关键区别：TS 箭头函数用 `{}` 就能写多行，不需要像 Python 那样切换到 `def`。

**补充：`=>` 还能用在类型标注里**

你会看到 `execute: (input: string) => string` 这种写法。这也是箭头，但它是**描述函数的类型**，不是定义函数：

```ts
// 1. 定义函数：=> 后面是函数体（实现）
const greet = (input: string): string => `hello ${input}`

// 2. 标注类型：=> 后面是返回值类型（形状描述），没有函数体
interface Tool {
  execute: (input: string) => string  // 输入 string，返回 string
}
```

```python
# Python 对照
# 1. 定义函数
def greet(input: str) -> str: return f"hello {input}"

# 2. 标注类型：用 Callable
from typing import Callable
class Tool:
    execute: Callable[[str], str]  # 输入 str，返回 str
```

同一个 `=>` 符号两种角色：左边是定义函数（后面跟函数体），右边是描述函数类型（后面跟返回值类型）。TS 复用这个符号，因为函数的"形状"本来就是"参数 → 返回值"。看到 `=>` 时注意上下文：有函数体是实现，只有类型是签名。

**2. 解决 this 绑定问题（历史原因）**

这是箭头函数被发明的真正原因。普通函数里的 `this` 会随调用方式变化（谁调用就指向谁），经常出错。箭头函数**没有自己的 this**，它继承外层的 this：

```ts
class Counter {
  count = 0
  start() {
    // 普通函数：this 指向不对，会报错
    setInterval(function () { this.count++ }, 1000)  // ❌ this 不是 Counter

    // 箭头函数：继承外层 this，指向正确
    setInterval(() => { this.count++ }, 1000)        // ✅ this 是 Counter
  }
}
```

> Python 没有这个痛点——Python 的 `self` 是显式参数，不存在 this 漂移问题。所以这个动机对 Python 背景的人来说不太直观，但它是 JS 历史包袱的产物。

**3. 为什么 opencode 大量用箭头函数**

opencode 的代码风格偏好用 `const + 箭头函数` 定义函数，而不是 `function` 声明：

```ts
// opencode 的常见写法
export const average = (a: number, b: number): number => (a + b) / 2
```

因为 `const` 箭头函数像变量赋值，类型标注更直观，和 `interface`/`type` 里的函数签名写法一致。后续你会看到 opencode 源码里绝大多数函数都是这么定义的。

## union 类型（联合类型）

Python 3.10+ 你可以写 `str | int` 表示"可以是字符串或整数"。TypeScript 也有完全一样的语法：

```ts
// 可以是 string 或 number
function format(value: string | number): string {
  // value 的类型是 string | number
  // 要用 value 的方法前需要先判断类型（后续讲 narrowing）
  return String(value)
}

// 联合字面量类型：只能取这几个值之一
// 类似 Python 的 Literal["build", "plan"]
type AgentMode = "build" | "plan" | "general"
const mode: AgentMode = "build"  // 只能是这三个字符串之一
```

opencode 里到处都是 union。看真实代码 [`opencode/packages/core/src/session.ts:111`](../../../opencode/packages/core/src/session.ts)：

```ts
export type Error = NotFoundError | MessageDecodeError | OperationUnavailableError | PromptConflictError
```

这表示"Session 的 Error 是这四种错误之一"。

## interface vs type：定义对象形状

这是 TS 最常用的两个东西。它们都用来描述"一个对象长什么样"。

### interface

```ts
// 描述一个 Tool 工具对象的结构
interface Tool {
  id: string          // 必须有 id，是 string
  description: string // 必须有 description
  execute: (input: string) => string  // 必须有 execute 函数
}

// 使用
const myTool: Tool = {
  id: "read",
  description: "读取文件",
  execute: (path) => "文件内容"
}
```

```python
# Python 对照：类似 TypedDict 或 dataclass
from dataclasses import dataclass

@dataclass
class Tool:
    id: str
    description: str
    # Python 里函数类型标注更复杂，这里简化
```

### type

`type` 能做同样的事，还能做更多（union、交叉类型等）：

```ts
// 用 type 描述同样的对象结构
type Tool = {
  id: string
  description: string
  execute: (input: string) => string
}
```

### interface 和 type 有什么区别？

对于描述对象结构，两者**几乎可以互换**。初学阶段你不需要纠结，记住：

- **描述对象形状** → `interface` 和 `type` 都行，opencode 两种都用
- **union（`A | B`）** → 只能用 `type`
- **扩展（继承）** → `interface` 用 `extends`，`type` 用 `&`（交叉类型，后续讲）

看到 opencode 代码里用哪个就理解哪个，不用纠结选哪个。

## 泛型

泛型就是"类型的参数"。Python 3.12+ 的 `def foo[T](x: T) -> T` 你应该见过。

```ts
// TypeScript 泛型：<T> 是类型参数
function identity<T>(value: T): T {
  return value
}

const a = identity<number>(5)        // T = number，返回 number
const b = identity<string>("hello")  // T = string，返回 string
```

```python
# Python 对照（3.12+ 语法）
def identity[T](value: T) -> T:
    return value
```

### 泛型在 opencode 里的真实用法

看 opencode 的 Tool 定义 [`opencode/packages/opencode/src/tool/tool.ts:55`](../../../opencode/packages/opencode/src/tool/tool.ts)：

```ts
export interface Def<
  Parameters extends Schema.Decoder<unknown> = Schema.Decoder<unknown>,
  M extends Metadata = Metadata,
> {
  id: string
  description: string
  parameters: Parameters
  execute(args: Schema.Schema.Type<Parameters>, ctx: Context<M>): Effect.Effect<ExecuteResult<M>>
}
```

先别慌，看不懂正常。这里只是让你感受一下：

- `<Parameters, M>` 是两个类型参数（类比 Python 的 `def foo[Parameters, M]`）
- `extends Schema.Decoder<unknown>` 是约束（类比 Python 的 `T: Hashable`），表示 Parameters 必须是某种 Decoder 类型
- `= Schema.Decoder<unknown>` 是默认值（类比 Python 函数参数默认值）
- `Schema.Schema.Type<Parameters>` 是把 Parameters 传给另一个类型工具做转换（类比 `list[T]` 把 T 传给 list）

**这个阶段你不需要写出这样的代码，只要看到 `<T>` 知道"这是泛型，T 是个类型占位符"就行。** 后续实现 Tool 系统时会手把手带你看懂。

## Record：快捷的字典类型

`Record<K, V>` 是 TS 里描述"键值对字典"的快捷方式：

```ts
// Record<string, number>：键是 string，值是 number
const scores: Record<string, number> = {
  alice: 95,
  bob: 87,
}

// 等价的写法（用索引签名）
const scores2: { [key: string]: number } = {
  alice: 95,
}
```

```python
# Python 对照
scores: dict[str, int] = {"alice": 95, "bob": 87}
```

opencode 里经常用 `Record<string, Tool>` 表示"一个工具表，键是工具名，值是 Tool 对象"。

## 跑一下示例代码

本课的示例代码在 [`src/type-demo.ts`](../../../src/type-demo.ts)。跑一下确认：

```bash
bun run src/type-demo.ts
```

输出会演示每种类型的实际值。

## 本课小结

你学会了（能认出）：

1. **基本类型标注**：`string` / `number` / `boolean` / `string[]`（注意和 Python 的大小写差异）
2. **函数类型**：`(a: number): number`，箭头函数 `=>`
3. **union 类型**：`string | number`，字面量联合 `"build" | "plan"`
4. **interface / type**：描述对象形状，类比 dataclass / TypedDict
5. **泛型 `<T>`**：类型的参数，类比 Python 泛型
6. **Record**：快捷的字典类型，类比 `dict[K, V]`

记住：**本课只是建立印象，不求全懂。** 后面遇到新的 TS 语法会随用随讲。

下一步：[0.3 项目脚手架](../03-project-scaffold/README.md) —— 配置 package.json 和 tsconfig.json。
