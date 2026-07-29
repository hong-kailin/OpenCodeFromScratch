# 从 Python 到 TypeScript：环境搭建全流程（原文合集）

> 本文件为 docs/00-env-basics 下 7 篇课程 README 的合并，作为口播稿的画面信息源（双源原则）。开发阶段实现章节画面时回这里抽细节。

# 0.1 Bun 起步：JS 运行时与包管理器

> 本课目标：理解 Bun 是什么，跑通第一个 TypeScript 程序，学会读报错和 `console.log` 打点调试。

## Bun 是什么

你写 Python 代码，需要两样东西：

1. **Python 解释器**——读你的 `.py` 文件，执行它
2. **pip / uv**——安装第三方库（`pip install requests`）

Bun 把这两样东西合二为一：

| Python 世界 | Bun 世界 |
|-------------|----------|
| Python 解释器（`python`） | Bun 运行时（`bun`） |
| pip / uv | Bun 包管理器（`bun install`） |
| `.py` 文件 | `.ts` / `.js` 文件 |
| `python script.py` | `bun run script.ts` |

那 Node.js 呢？Node.js 是更老的 JS 运行时，Bun 是后来者。Bun 兼容 Node.js 的大部分 API，但更快，且**原生支持直接运行 `.ts` 文件**——不需要先编译成 `.js`。这一点对我们特别重要：写完 `.ts` 直接 `bun run` 就能跑，像 `python script.py` 一样直接。

> 为什么 opencode 选 Bun 而不是 Node.js？性能是一个原因，但更关键的是 **原生 TypeScript 支持** 和 **一体化工具链**（运行时 + 包管理器 + 打包器合一个工具）。opencode 的 `package.json` 里写的是 `"packageManager": "bun@1.3.14"`。

## 安装与验证

你的环境已经装好了 Bun。验证一下：

```bash
bun --version
# 期望输出类似：1.3.13
```

> 如果没装，按系统来（三系统安装命令）：
>
> - **macOS**：`brew install oven-sh/bun/bun`，或 `curl -fsSL https://bun.sh/install | bash`
> - **Linux**：`curl -fsSL https://bun.sh/install | bash`
> - **Windows**（PowerShell）：`powershell -c "irm bun.sh/install.ps1|iex"`，或 `winget install Oven-sh.Bun`
>
> 装完重开终端，再 `bun --version` 验证。

## 第一个程序：直接跑 .ts

先看我们要跑的代码。打开 [`src/index.ts`](../../../src/index.ts)：

```ts
// src/index.ts
// 这是 opencode-from-scratch 的入口文件
// console.log 类似 Python 的 print()，把内容打印到终端

console.log("hello opencode")
```

**不用任何配置、不用编译**，直接跑：

```bash
bun run src/index.ts
```

期望输出：

```
hello opencode
```

就这样。你写了一个 TypeScript 文件，直接运行了它。

### 和 Python 对照

```python
# Python 版本
print("hello opencode")
```

```ts
// TypeScript 版本
console.log("hello opencode")
```

几个差异先记住：

| | Python | TypeScript |
|---|--------|------------|
| 打印 | `print()` | `console.log()` |
| 字符串引号 | `"..."` 或 `'...'` | `"..."` 或 `'...'`（一样） |
| 语句结尾 | 不需要分号 | 分号可选（opencode 约定**不写**分号） |
| 注释 | `# 注释` | `// 注释` |

注意 opencode 的代码风格是**不写分号**的——你会看到 `console.log("hello")` 而不是 `console.log("hello");`。我们也跟随这个约定。

## 教 Debug：读报错

代码不会总是一次跑通。学会读报错是第一步。

故意制造一个错误。看 [`src/error-demo.ts`](../../src/error-demo.ts)：

```ts
// src/error-demo.ts
// 故意写错，演示如何读报错

console.log("开始")
console.log(undefinedVariable)  // 这个变量没定义
console.log("结束")
```

跑一下：

```bash
bun run src/error-demo.ts
```

你会看到类似这样的报错：

```
开始
1 | // src/error-demo.ts
2 | // 故意写错，演示如何读报错
3 |
4 | console.log("开始")
5 | console.log(undefinedVariable) // 这个变量没定义
                                 ^
ReferenceError: undefinedVariable is not defined
      at /Users/.../src/error-demo.ts:5:30
```

读报错的套路（和 Python 的 Traceback 一样）：

1. **先看出错代码**：第 5 行，`^` 指向 `undefinedVariable`——这里出问题了
2. **错误类型** `ReferenceError: undefinedVariable is not defined` —— 引用了一个不存在的变量
3. **位置** `at /Users/.../src/error-demo.ts:5:30` —— 哪个文件、第几行、第几列

> Python 对照：这就像 Python 的 `NameError: name 'undefinedVariable' is not defined` + `File "x.py", line 4`。读法完全一样：先看错误类型，再找文件和行号。

## 教 Debug：console.log 打点

最朴素也最有效的 debug 方法：在代码里加 `console.log` 打印变量值，看它是不是你以为的那个值。

看 [`src/debug-demo.ts`](../../src/debug-demo.ts)：

```ts
// src/debug-demo.ts
// 演示用 console.log 打点调试

// 假设我们有一个函数，算两个数的平均值，但结果不对
function average(a: number, b: number): number {
  const sum = a + b
  // 打印中间变量，看 sum 是不是对的
  console.log("debug: sum =", sum)
  const result = sum / 2
  // 打印最终结果
  console.log("debug: result =", result)
  return result
}

const answer = average(10, 20)
console.log("最终答案:", answer)
```

跑一下：

```bash
bun run src/debug-demo.ts
```

输出：

```
debug: sum = 30
debug: result = 15
最终答案: 15
```

通过打印中间变量，你能确认每一步计算是否符合预期。这是 debug 最基本的手法——后续课程会教更强大的 VSCode 断点调试（0.4 课），但 `console.log` 永远是你第一选择。

> Python 对照：这和 `print(f"debug: sum = {sum}")` 一模一样。`console.log` 可以接受多个参数，用空格分隔打印，所以 `console.log("debug: sum =", sum)` 不需要模板字符串。

## 本课小结

你学会了：

1. **Bun 是什么**：JS 运行时 + 包管理器，二合一，类比 Python 解释器 + pip
2. **直接跑 .ts**：`bun run src/index.ts`，无需编译，类比 `python script.py`
3. **读报错**：看错误类型 → 找文件:行号 → 看 `^` 指向的位置
4. **console.log 打点**：打印中间变量，确认每步是否符合预期

下一步：[0.2 TypeScript 初步](./02-typescript-types.md) —— 了解 TypeScript 的类型系统。

## 怎么跑本课的代码

```bash
# 第一个程序
bun run src/index.ts

# 看报错（故意出错的）
bun run src/error-demo.ts

# 打点调试示例
bun run src/debug-demo.ts
```


---

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


---

# 0.3 模块系统：import 与 export

> 本课目标：理解 TS/JS 的模块系统，学会把代码拆成多文件并用 import/export 互相关联。

## 为什么需要模块

目前为止我们写的代码都在一个文件里。但 opencode 有几百个文件——`session/`、`tool/`、`agent/` 各管各的。代码长了就要拆文件，拆了文件就要有办法互相调用。

Python 你已经很熟悉了：

```python
# math_utils.py
def add(a, b):
    return a + b

# main.py
from math_utils import add      # 从 math_utils.py 导入 add 函数
print(add(1, 2))
```

TypeScript 的思路完全一样，只是语法不同：用 `export` 导出，用 `import` 导入。

## export：导出

在 TS 里，想 让别的文件用你写的函数/类型/变量，前面加 `export`：

```ts
// src/math-utils.ts

// 命名导出：加 export 关键字
export function add(a: number, b: number): number {
  return a + b
}

export function multiply(a: number, b: number): number {
  return a * b
}

// 也可以导出类型
export type Operation = "add" | "multiply"
```

```python
# Python 对照：在 math_utils.py 里
def add(a, b):       # Python 默认所有顶层定义都能被 import
    return a + b     # 不需要写 export

def multiply(a, b):
    return a * b
```

> 关键区别：Python 默认所有顶层定义都能被导入，TS 必须显式写 `export` 才行。不写 `export` 的东西是模块私有的，外部访问不到。

## import：导入

```ts
// src/main.ts

// 从本地文件导入：注意要写 .ts 扩展名（Bun 运行时可以省略，但写上也行）
// 花括号里是要导入的名字，必须和 export 的名字一致
import { add, multiply, type Operation } from "./math-utils"

const result = add(1, 2)
const op: Operation = "add"
```

```python
# Python 对照
from math_utils import add, multiply, Operation
```

几个要点：

1. **`"./math-utils"`**：以 `./` 开头表示**相对路径**（当前目录）。类比 Python 的 `from math_utils import ...`
2. **花括号 `{ }`**：命名导入，只导入你需要的那几个。类比 Python 的 `from math_utils import add, multiply`
3. **`type Operation`**：`type` 前缀表示只导入类型（编译后会被删除，不占运行时体积）。类型和函数可以混在一个 import 语句里

## 跑一下

看教学代码 [`src/math-utils.ts`](../../../src/math-utils.ts) 和 [`src/module-demo.ts`](../../../src/module-demo.ts)：

```bash
bun run src/module-demo.ts
```

## 默认导出 vs 命名导出

上面用的是**命名导出**（named export），一个文件可以 export 多个东西。还有一种叫**默认导出**（default export），一个文件只能有一个：

```ts
// src/logger.ts

// 默认导出：一个文件只能有一个 default
export default function log(message: string): void {
  console.log(`[LOG] ${message}`)
}

// 也可以同时有命名导出
export const LOG_LEVEL = "info"
```

```ts
// src/main.ts

// 导入默认导出：不用花括号，名字随你取
import log from "./logger"

// 导入命名导出：用花括号
import { LOG_LEVEL } from "./logger"

// 混合导入
import log, { LOG_LEVEL } from "./logger"
```

```python
# Python 没有默认导出的概念
# 最接近的类比是 __all__ 控制 from module import * 的行为，但用法完全不同
```

> **opencode 的约定**：几乎只用命名导出，不用默认导出。看 opencode 源码 [`opencode/packages/opencode/src/index.ts:3`](../../../opencode/packages/opencode/src/index.ts)：

```ts
import { RunCommand } from "./cli/cmd/run"
import { GenerateCommand } from "./cli/cmd/generate"
import { ConsoleCommand } from "./cli/cmd/account"
```

全是花括号命名导入。我们也跟随这个约定。

## 第三方包的导入

除了本地文件，还能导入第三方包（通过 `bun install` 安装的）：

```ts
// 导入第三方包：不需要路径，直接写包名
import yargs from "yargs"                          // 默认导入
import { hideBin } from "yargs/helpers"            // 命名导入，子路径
```

```python
# Python 对照
import yargs                        # import 包
from yargs.helpers import hideBin   # 从包的子模块导入
```

第三方包的导入不需要 `./` 前缀，直接写包名。这个我们在下一课（package.json）装依赖时会用到。

## import 的路径写法

| 写法 | 含义 | 例子 |
|------|------|------|
| `"./foo"` | 当前目录的 foo 文件 | `import { add } from "./math-utils"` |
| `"../foo"` | 上级目录的 foo 文件 | `import { add } from "../utils/math-utils"` |
| `"包名"` | 第三方包（node_modules 里） | `import yargs from "yargs"` |
| `"@/foo"` | 路径别名（需要 tsconfig 配置） | `import { add } from "@/utils/math"` |

最后一种 `@/` 别名需要 tsconfig.json 配置（下下课讲），opencode 源码大量使用。现在你只需要知道 `./` 和 `../` 两种相对路径写法。

## 教 Debug：模块找不到

import 写错路径会报错：

```
error: Cannot find module "./math-util" from "src/main.ts"
```

读法：

1. `Cannot find module` —— 找不到模块
2. `"./math-util"` —— 你写的路径
3. `from "src/main.ts"` —— 在哪个文件里 import 的

常见原因：路径写错（`math-utils` 写成 `math-util`）、文件名拼错、忘记 `./` 前缀（写成 `"math-utils"` 会被当成第三方包去找）。

> Python 对照：类似 `ModuleNotFoundError: No module named 'math_util'`。排查方法一样——检查文件名和路径。

## 本课小结

你学会了：

1. **export**：导出函数/类型/变量，让别的文件能用（Python 默认都能导入，TS 要显式 export）
2. **import**：导入其他文件的导出，花括号 `{ }` 是命名导入
3. **默认导出 vs 命名导出**：opencode 只用命名导出，我们也跟随
4. **路径写法**：`./` 当前目录、`../` 上级目录、包名是第三方包
5. **读模块报错**：Cannot find module → 检查路径和文件名

下一步：[0.4 package.json](../04-package-json/README.md) —— 项目配置与依赖管理。


---

# 0.4 package.json：项目配置与依赖管理

> 本课目标：理解 package.json 的作用，给项目搭好正式的配置，学会安装依赖和自定义命令。

## 从上一课的悬念说起

上一课讲 import 时提到，除了导入本地文件（`import { add } from "./math-utils"`），还能导入第三方包：

```ts
import yargs from "yargs"  // 不需要 ./，直接写包名
```

但如果你想 `import yargs`，得先把这个包装到项目里。Python 里你用 `pip install yargs`，TS 里用什么？这就需要 package.json 了。

## package.json 是什么

你写 Python 项目时，`pyproject.toml` 是项目的"身份证"——项目名、版本、依赖列表、自定义命令都在里面。TypeScript 项目的对应物是 `package.json`。

| Python 世界 | TypeScript 世界 |
|-------------|-----------------|
| `pyproject.toml` | `package.json` |
| `pip install` | `bun install` / `bun add` |
| `uv.lock` / `poetry.lock` | `bun.lock` |
| `.venv/` | `node_modules/` |

## 创建 package.json

最简单的方式是手动创建。看我们项目的 [`package.json`](../../../package.json)：

```json
{
  "name": "opencode-from-scratch",
  "version": "0.0.1",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "bun run src/index.ts",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@tsconfig/bun": "latest",
    "@types/bun": "latest",
    "typescript": "latest"
  }
}
```

逐块解释。

## 基本字段

```json
{
  "name": "opencode-from-scratch",
  "version": "0.0.1",
  "private": true
}
```

- **`name`**：项目名（类比 `pyproject.toml` 里的 `name`）
- **`version`**：版本号，语义化版本（类比 Python 包版本）
- **`private: true`**：标记为私有项目，防止不小心发布到 npm（类比 Python 私有包）

## type: "module"

```json
"type": "module"
```

这一行很重要。它告诉 Bun/Node：这个项目用 **ESM 模块系统**（`import/export`），而不是老的 CommonJS（`require`）。

> 上一课你学的 `import { add } from "./math-utils"` 就是 ESM 语法。如果不写 `"type": "module"`，`.ts` 文件里的 `import` 可能会报错（默认走 CommonJS）。opencode 的 package.json 也有 `"type": "module"`。

## scripts：自定义命令

```json
"scripts": {
  "dev": "bun run src/index.ts",
  "typecheck": "tsc --noEmit"
}
```

`scripts` 类比 Makefile 或 `pyproject.toml` 的 `[project.scripts]`。定义后用 `bun run <命令名>` 执行：

```bash
bun run dev        # 等价于 bun run src/index.ts
bun run typecheck  # 等价于 tsc --noEmit
```

> 对照 opencode：它的 scripts 里有 `"dev": "bun run --cwd packages/opencode --conditions=browser src/index.ts"`，多了 `--cwd`（切换目录，因为是 monorepo）和 `--conditions=browser`（条件导出）。我们简化版不需要这些。

## dependencies vs devDependencies

```json
"dependencies": {
  "yargs": "^18.0.0"        // 生产依赖：运行时需要的包
},
"devDependencies": {
  "typescript": "latest",    // 开发依赖：只在开发时需要
  "@tsconfig/bun": "latest"
}
```

| | dependencies | devDependencies |
|---|---|---|
| 作用 | 运行时需要的包 | 只在开发/编译/检查时需要 |
| Python 类比 | `dependencies`（在 `pyproject.toml`） | `dev-dependencies` / `optional-dependencies` |
| 例子 | `yargs`（CLI 解析，程序运行要用） | `typescript`（类型检查，部署后不需要） |

**区分原则**：如果用户安装后**运行程序**时还需要这个包，放 `dependencies`；如果只是**开发/编译/检查**时需要，放 `devDependencies`。

> 我们现在只装了 devDependencies（typescript、@tsconfig/bun、@types/bun），因为还没有运行时依赖。等到阶段 1 调 LLM API 时会装第一个 dependencies。

## 安装依赖

创建好 package.json 后，跑：

```bash
bun install
```

这一条命令会读 package.json 的依赖列表，把它们全装到 `node_modules/` 里。类比 `pip install -e .` 或 `uv sync`。

会发生几件事：

1. 下载所有依赖包到 `node_modules/`（类比 `.venv/`，但放在项目根目录）
2. 生成 `bun.lock` 锁文件（类比 `uv.lock`，锁定每个包的精确版本，保证团队一致）

### 添加新依赖

```bash
bun add yargs           # 添加到 dependencies（类比 pip install yargs）
bun add -d typescript   # -d 表示添加到 devDependencies
```

`bun add` 会自动更新 package.json 并写入 `bun.lock`。

### 版本号写法

```json
"typescript": "latest"     // 最新版
"yargs": "^18.0.0"         // 兼容 18.x.x（^ 表示允许 minor/patch 更新）
"yargs": "~18.0.0"         // 兼容 18.0.x（~ 表示只允许 patch 更新）
"yargs": "18.0.0"          // 精确版本
```

> 类比 Python 的版本约束：`^18.0.0` 类似 `>=18.0.0,<19.0.0`。

## node_modules 与 .gitignore

`bun install` 会生成 `node_modules/` 目录，里面是所有依赖包的源码。这个目录**很大**，不能提交到 git。需要 `.gitignore` 忽略它：

```
node_modules/
*.log
.DS_Store
```

> 类比 Python：`.venv/` 也不提交到 git，用 `.gitignore` 忽略。`bun.lock` **要提交**（保证团队依赖版本一致），类比 `uv.lock` 要提交。

## 跑起来验证

创建好 package.json 后：

```bash
# 安装依赖
bun install

# 用 scripts 快捷命令跑程序
bun run dev
```

期望 `bun run dev` 输出 `hello opencode`。

> 注意：现在 `bun run dev` 能跑了，但 `bun run typecheck` 还不行——因为还没有 tsconfig.json（下一课讲）。

## 教 Debug：包找不到

如果你 `import` 了一个没装的包：

```ts
import yargs from "yargs"  // 但没跑过 bun add yargs
```

运行时会报：

```
error: Cannot find module "yargs" from "src/index.ts"
```

这和上一课"模块找不到"的报错一样，但区别是：**没有 `./` 前缀的包名**找不到，说明你没装这个第三方包。解决方法：`bun add yargs`。

> Python 对照：`ModuleNotFoundError: No module named 'yargs'` → `pip install yargs`。

## 本课小结

你学会了：

1. **package.json**：项目元信息 + 依赖清单 + scripts 命令（类比 `pyproject.toml`）
2. **type: "module"**：声明用 ESM 模块系统（和上一课的 import/export 对应）
3. **scripts**：自定义命令，`bun run dev` / `bun run typecheck`
4. **dependencies vs devDependencies**：运行时 vs 开发时依赖
5. **bun install / bun add**：安装依赖 / 添加依赖（类比 `pip install`）
6. **node_modules 与 bun.lock**：前者不提交（.gitignore），后者要提交
7. **读包找不到报错**：Cannot find module + 包名（无 `./`）→ 没装依赖

下一步：[0.5 tsconfig.json](../05-tsconfig/README.md) —— TypeScript 编译配置。


---

# 0.5 tsconfig.json：TypeScript 编译配置

> 本课目标：理解 tsconfig.json 的作用，给项目配好类型检查，学会读 TS 报错。

## 从上一课的悬念说起

上一课创建 package.json 时，scripts 里定义了：

```json
"typecheck": "tsc --noEmit"
```

但我说"`bun run typecheck` 还不行——因为还没有 tsconfig.json"。现在来解决它。

先问一个问题：`bun run src/index.ts` 能直接跑 `.ts` 文件，为什么还需要配置类型检查？

**因为运行和检查是两回事。** Bun 运行时直接跑代码，不做类型检查——类型标注在运行时会被忽略（就像 Python 运行时不检查 type hints）。如果你写了 `const x: number = "hello"`，Bun 照样跑，不会报错。要发现这种类型错误，需要单独跑类型检查器（`tsc`），而 `tsc` 需要一个配置文件告诉它怎么检查——这就是 tsconfig.json。

| | 运行（Bun） | 类型检查（tsc） |
|---|---|---|
| 什么时候 | `bun run` | `bun run typecheck` |
| 做什么 | 执行代码 | 扫描代码找类型错误 |
| 类比 Python | `python script.py` | `mypy script.py` |
| 需要配置 | 不需要 | 需要 tsconfig.json（类比 mypy.ini） |

## tsconfig.json 是什么

`tsconfig.json` 是 TypeScript 编译器/类型检查器的配置文件，告诉 `tsc`：

- 检查哪些文件
- 用什么规则检查
- 路径别名怎么解析

类比 Python 的 `mypy.ini`——告诉 mypy 检查哪些目录、开不开严格模式。

## 创建 tsconfig.json

看我们项目的 [`tsconfig.json`](../../../tsconfig.json)：

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "@tsconfig/bun/tsconfig.json",
  "compilerOptions": {
    "strict": true,
    "noEmit": true,
    "types": ["bun"],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "opencode", "src/error-demo.ts", "src/type-error-demo.ts"]
}
```

`$schema` 字段是给编辑器用的——指向 JSON Schema，让 VSCode 在编辑 tsconfig.json 时能自动补全字段名和提示。opencode 的 tsconfig.json 也有这行。它不影响编译行为，纯编辑器辅助。

逐块解释。

## extends：继承预设

```json
"extends": "@tsconfig/bun/tsconfig.json"
```

`@tsconfig/bun` 是官方维护的 Bun 专用预设，帮你设好了 `target`、`module`、`moduleResolution` 等一堆字段。我们不需要自己写这些，继承预设就行。

> 类比 Python：继承一个基础 `pyproject.toml` 模板，只覆盖自己需要的字段。opencode 的 tsconfig.json 也是这么做的。

## compilerOptions：检查规则

```json
"compilerOptions": {
  "strict": true,
  "noEmit": true,
  "types": ["bun"],
  "paths": {
    "@/*": ["./src/*"]
  }
}
```

### strict: true

开启严格类型检查（类比 `mypy --strict`）。推荐开启，能及早发现类型错误，比如：

- 变量没标注类型时报错（禁止隐式 any）
- 可能为 undefined 的值直接访问时报错

### noEmit: true

只做类型检查，**不输出**编译后的 `.js` 文件。因为 Bun 直接跑 `.ts`，我们不需要编译产物。

> 如果不写 `noEmit: true`，`tsc` 会在每个 `.ts` 旁边生成一个 `.js` 文件，项目里会很乱。

### types: ["bun"]

加载 Bun 的类型定义。**这行很关键**——没有它，`console`、`Bun` 等全局变量会报 "Cannot find name 'console'" 错误。

为什么？因为 `@tsconfig/bun` 预设的 `lib` 不含 DOM 库（DOM 里有 `console`）。Bun 运行时确实有 `console`，但类型检查器不知道。`@types/bun` 包提供了 Bun 环境的类型定义（包括 `console`），`types: ["bun"]` 告诉 tsc 加载它。

> 这个坑我踩过——第一次配 tsconfig 时 `bun run typecheck` 报了一堆 "Cannot find name 'console'"，就是漏了这行。

### paths：路径别名

```json
"paths": {
  "@/*": ["./src/*"]
}
```

这行让 `@` 成为 `src/` 的别名。有了它，你可以写：

```ts
// 没有 paths：相对路径，层级深时很难写
import { read } from "../../../tool/read"

// 有 paths：用 @ 别名，从 src 根开始
import { read } from "@/tool/read"
```

> 对照 opencode：它的 tsconfig.json 里就是 `"paths": {"@/*": ["./src/*"]}`。opencode 源码里到处都是 `import ... from "@/tool/..."`、`import ... from "@/session/..."`。我们后续阶段会大量用到这个别名。

## include 与 exclude：限定检查范围

```json
"include": ["src/**/*.ts"],
"exclude": ["node_modules", "opencode", "src/error-demo.ts"]
```

### include：只检查 src/

`"src/**/*.ts"` 表示检查 `src/` 目录下所有 `.ts` 文件（`**` 是递归匹配任意子目录）。

**这很重要**——如果不限定，`tsc` 会扫描整个项目目录，包括 `opencode/` 参考源码（31 个 package，几百个文件），报一堆和我们无关的错误。

### exclude：排除不需要检查的

- `node_modules`：第三方依赖，不归我们管
- `opencode`：只读参考源码，不归我们管
- `src/error-demo.ts`：0.1 课故意写错的教学代码（演示运行时报错用的），typecheck 会报错，排除掉

> 类比 Python：mypy 配置里也会 exclude `venv/`、`build/` 等目录。

## 跑类型检查

配好 tsconfig.json 后：

```bash
bun run typecheck
```

如果代码没问题，命令**没有任何输出**（静默成功）。如果有类型错误，会打印错误信息。

## 教 Debug：TS 报错怎么读

类型检查报错和运行时报错格式不同。故意写一个类型错误，看 [`src/type-error-demo.ts`](../../../src/type-error-demo.ts)：

```ts
// src/type-error-demo.ts
// 故意写类型错误，演示 tsc 报错格式

const num: number = "hello" // 把 string 赋给 number
```

跑 `bun run typecheck`，会看到：

```
src/type-error-demo.ts:4:7 - error TS2322: Type 'string' is not assignable to type 'number'.

4 const num: number = "hello"
        ~~~
```

读法：

1. **位置** `src/type-error-demo.ts:4:7` —— 文件、第 4 行、第 7 列
2. **错误码** `TS2322` —— TypeScript 的错误编号，可以搜这个码查原因
3. **描述** `Type 'string' is not assignable to type 'number'` —— 把 string 赋给 number 类型变量
4. **`~~~`** —— 标出出错的变量名

> 和运行时报错的区别：类型错误是**编译时**检查出来的，代码根本没跑就报错了。Python 的 mypy 报错也是这个风格。

## 运行时错误 vs 类型错误

现在你见过两种错误了，对比一下：

| | 运行时错误（Bun） | 类型错误（tsc） |
|---|---|---|
| 什么时候发现 | 代码跑到那一行时 | 代码运行前（类型检查阶段） |
| 报错格式 | `ReferenceError: xxx is not defined` | `error TS2322: Type ... is not assignable` |
| 例子 | 访问不存在的变量 | 把 string 赋给 number |
| Python 类比 | `NameError` / `TypeError`（运行时） | mypy 报错（检查时） |

**类型错误越早发现越好**——在写代码时（编辑器红线）就发现，比上线后崩掉好得多。这就是为什么要配 tsconfig + typecheck。

## 跑起来验证

```bash
# 类型检查（应该无输出，表示通过）
bun run typecheck

# 也能正常运行
bun run dev
```

## 本课小结

你学会了：

1. **tsconfig.json**：TS 类型检查器的配置（类比 `mypy.ini`），`tsc` 需要 it 才能工作
2. **extends**：继承 `@tsconfig/bun` 预设，少写配置
3. **strict**：严格类型检查
4. **noEmit**：只检查不产出 .js 文件
5. **types: ["bun"]**：加载 Bun 类型定义，让 `console` 等全局变量被识别
6. **paths**：`@/*` → `./src/*` 路径别名，opencode 大量使用
7. **include/exclude**：限定检查范围，排除 opencode 参考源码和教学错误代码
8. **读 TS 报错**：文件:行:列 + 错误码 TSXXXX + 描述
9. **运行时错误 vs 类型错误**：前者跑到才报，后者运行前就报

下一步：[0.6 VSCode 调试](../06-vscode-debug/README.md) —— 学会用断点调试代码。


---

# 0.6 VSCode 调试：断点与调试器

> 本课目标：学会用 VSCode 断点调试 TypeScript 代码，不再只靠 console.log。

## 为什么需要断点调试

到目前为止你用 `console.log` 打点调试——在代码里加打印语句，看变量值对不对。这很有效，但有局限：

- 想看某个条件下的变量值，要加 `if` + `console.log`，改完再跑一遍
- 想看函数调用链，要手动一层层加打印
- 程序状态复杂时（比如循环里、多层嵌套），打印太多看不过来

断点调试解决这些问题：**暂停程序、查看所有变量、一步步执行、随时改变量**。就像 Python 里用 `pdb` 或 PyCharm 的调试器，只是换到 VSCode + Bun。

## 准备：安装 Bun 扩展

VSCode 默认不会调试 Bun，需要装扩展：

1. 打开 VSCode，左侧 Extensions 面板（快捷键 `Cmd+Shift+X`）
2. 搜索 `Bun`，安装 **"Bun for Visual Studio Code"**（作者是 Oven Software）
3. 装好后 VSCode 就能识别 Bun 的调试类型

## launch.json：调试配置

VSCode 调试需要一份配置文件告诉它"调试什么、怎么调试"。看我们项目的 [`.vscode/launch.json`](../../../.vscode/launch.json)：

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "bun",
      "request": "launch",
      "name": "Debug Current File",
      "program": "${file}",
      "cwd": "${workspaceFolder}"
    }
  ]
}
```

逐字段解释：

- **`type: "bun"`**：调试类型是 Bun（刚装的扩展提供）
- **`request: "launch"`**：启动模式，直接启动程序并调试。另一种是 `attach`（附加到已运行的进程），opencode 用的就是 attach 模式
- **`name`**：配置名，显示在调试面板下拉菜单里
- **`program: "${file}"`**：调试当前打开的文件。`${file}` 是 VSCode 变量，表示当前编辑器里打开的文件
- **`cwd: "${workspaceFolder}"`**：工作目录设为项目根目录

> 对照 opencode：它的 [`.vscode/launch.example.json`](../../../opencode/.vscode/launch.example.json) 用的是 `attach` 模式，连到 `ws://localhost:6499/`——因为它要调试的是正在运行的 TUI 程序。我们用更简单的 `launch` 模式，直接启动调试。

## 设断点

断点是最基本的调试操作：

1. 在 VSCode 里打开 [`src/debug-target.ts`](../../../src/debug-target.ts)
2. 把光标移到某一行，点击行号左侧的灰色区域——出现**红点**，表示设了断点
3. 也可以用快捷键 `F9` 切换当前行断点

> 类比 Python：和 PyCharm / VSCode Python 调试器完全一样——行号左边点一下设断点。

## 开始调试

设好断点后，开始调试：

1. 打开要调试的文件（如 `src/debug-target.ts`）
2. 按 `F5`（或左侧调试面板 → 选 "Debug Current File" → 点绿色播放按钮）
3. 程序启动，跑到断点处**暂停**

## 调试面板

程序暂停后，VSCode 左侧会显示调试面板：

| 面板 | 作用 | Python 类比 |
|------|------|-------------|
| **Variables** | 当前作用域的所有变量值 | PyCharm 的 Variables 面板 |
| **Watch** | 手动添加要监视的表达式 | PyCharm 的 Watches |
| **Call Stack** | 函数调用链（谁调用了当前函数） | Python 的 traceback，但是是"正向"的 |
| **Breakpoints** | 所有断点列表，可以启用/禁用 | — |

### 单步执行

程序暂停后，用这些按钮一步步走：

| 按钮 | 快捷键 | 作用 | Python 类比 |
|------|--------|------|-------------|
| Continue | `F5` | 继续运行到下一个断点 | pdb 的 `c` (continue) |
| Step Over | `F10` | 执行当前行，不进入函数内部 | pdb 的 `n` (next) |
| Step Into | `F11` | 执行当前行，**进入**函数内部 | pdb 的 `s` (step) |
| Step Out | `Shift+F11` | 执行完当前函数，回到调用处 | pdb 的 `r` (return) |
| Restart | `Cmd+Shift+F5` | 重新开始调试 | — |
| Stop | `Shift+F5` | 停止调试 | — |

> **Step Over vs Step Into 的区别**：当前行调用了函数 `foo()`——Step Over 执行完 `foo()` 停在下一行（把 `foo()` 当一步）；Step Into 会进入 `foo()` 内部暂停。

## 实操：调试 debug-target.ts

打开 [`src/debug-target.ts`](../../../src/debug-target.ts)，这个文件模拟一个"算成绩平均值"的逻辑，我们用断点看中间变量：

```ts
// src/debug-target.ts
function calculateAverage(scores: number[]): number {
  const sum = scores.reduce((acc, s) => acc + s, 0)
  const average = sum / scores.length   // ← 在这行设断点
  return average
}

const scores = [85, 92, 78, 96, 88]
const result = calculateAverage(scores)
console.log("平均分:", result)
```

操作步骤：

1. 打开 `src/debug-target.ts`
2. 在 `const average = sum / scores.length` 这行设断点（点行号左侧）
3. 按 `F5` 开始调试
4. 程序暂停在断点处：
   - **Variables** 面板能看到 `sum = 439`、`scores = [85, 92, 78, 96, 88]`
   - **Call Stack** 显示 `calculateAverage` ← 全局作用域
5. 按 `F10`（Step Over），`average` 变量出现，值是 `87.8`
6. 按 `F5`（Continue），程序跑完，终端输出 `平均分: 87.8`

## 进阶：条件断点

有时你不想每次都停，只想在**特定条件**下停。比如循环里只想看第 3 次迭代：

1. 右键点击行号左侧的断点红点
2. 选 "Edit Breakpoint..."
3. 输入条件表达式，比如 `i === 3`

程序只有当 `i === 3` 时才在这个断点暂停。类比 Python 里 `breakpoint()` 加 `if` 判断，但不用改代码。

## 进阶：日志断点（Logpoint）

如果你想打印变量但**不想暂停程序**——用日志断点：

1. 右键点击行号左侧
2. 选 "Add Logpoint..."
3. 输入要打印的内容，比如 `sum is {sum}`

程序跑到这行不会暂停，只在调试控制台打印一条消息。相当于自动加了一行 `console.log`，但不用改代码、不用重新跑。

> **什么时候用断点 vs console.log**：
> - **断点**：复杂逻辑、想看多个变量、想一步步走 → 用断点
> - **console.log**：快速看一个值、简单确认 → 用 console.log（更快，不用开调试器）
> - **日志断点**：循环里想看每次迭代的值，但不想暂停 → 用 Logpoint

## 教 Debug：按 F5 闪一下就没了

按 F5 后调试器启动了但瞬间消失？常见原因和解决方法：

1. **断点位置不对**：断点必须设在**会执行的代码行**上。比如设在 `function` 声明行上不会触发，要设在函数体内的语句行。确认断点是实心红点，且所在行会被执行到
2. **断点设成灰色空心圆**：断点被禁用了，点击红点重新启用（实心红才是启用的）
3. **断点所在的代码没执行到**：比如断点设在 `if` 块里但条件没满足。用条件断点或换一行设

## 本课小结

你学会了：

1. **launch.json**：VSCode 调试配置，`type: "bun"` + `request: "launch"`
2. **设断点**：行号左侧点击或 `F9`，断点要设在会执行的语句行上
3. **调试面板**：Variables（变量）、Watch（监视）、Call Stack（调用链）
4. **单步执行**：Step Over（`F10`，不进函数）、Step Into（`F11`，进函数）、Step Out（`Shift+F11`，出函数）
5. **条件断点**：只在满足条件时暂停
6. **日志断点**：不暂停只打印
7. **断点 vs console.log**：复杂用断点，简单用 console.log

下一步：[0.7 阶段验收](../07-stage-review/README.md) —— 跑起来 + 工程思维总结。


---

# 0.7 阶段验收：跑起来 + 工程思维总结

> 本课目标：验收阶段 0 的成果，总结学到的工程思维，对照 opencode 真实入口看差距。

## 验收清单

跑一遍这些命令，全部通过说明阶段 0 完成：

```bash
# 1. Bun 运行正常
bun --version

# 2. 程序能跑
bun run dev
# 期望输出：hello opencode

# 3. 类型检查通过
bun run typecheck
# 期望输出：无（静默成功）

# 4. 模块导入正常
bun run src/module-demo.ts
# 期望输出：add(10, 20): 30 等

# 5. VSCode 断点调试
# 打开 src/debug-target.ts → 设断点 → F5 → 程序暂停在断点
```

| 验收项 | 状态 |
|--------|------|
| Bun 安装、`.ts` 直接运行 | ✓ |
| TypeScript 类型标注（对照 Python type hints） | ✓ |
| import/export 模块系统 | ✓ |
| package.json 配置 + bun install | ✓ |
| tsconfig.json 配置 + typecheck | ✓ |
| VSCode 断点调试 | ✓ |

## 项目结构

阶段 0 结束后，我们的项目长这样：

```
opencode-from-scratch/
├── .gitignore               # 忽略 node_modules 等
├── .vscode/
│   └── launch.json          # VSCode 调试配置
├── package.json             # 项目配置（依赖、scripts）
├── tsconfig.json            # TS 编译配置
├── bun.lock                 # 依赖锁文件
└── src/
    ├── index.ts             # 入口：console.log("hello opencode")
    ├── math-utils.ts        # 模块导出演示
    ├── module-demo.ts       # 模块导入演示
    ├── type-demo.ts         # 类型系统演示
    ├── error-demo.ts        # 运行时报错演示
    ├── type-error-demo.ts   # 类型报错演示
    ├── debug-demo.ts        # console.log 打点演示
    └── debug-target.ts      # 断点调试目标
```

## 对照 opencode 真实入口

我们的 `src/index.ts`：

```ts
console.log("hello opencode")
```

opencode 的入口 [`opencode/packages/opencode/src/index.ts`](../../../opencode/packages/opencode/src/index.ts)：

```ts
import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import { RunCommand } from "./cli/cmd/run"
import { GenerateCommand } from "./cli/cmd/generate"
// ... 20 多个 import

const cli = yargs(args)
  .scriptName("opencode")
  .command(RunCommand)
  .command(GenerateCommand)
  // ... 注册各种子命令
```

差距很大，但能看出方向：

| | 我们的 index.ts | opencode 的 index.ts |
|---|-----------------|----------------------|
| 做什么 | 打印一句话 | 解析命令行参数，分发到子命令 |
| 用到的知识 | console.log | import、第三方包（yargs）、CLI 框架 |
| 对应阶段 | 阶段 0 | 阶段 8（CLI 入口） |

opencode 用 `yargs` 做命令行解析（类比 Python 的 `argparse`/`click`），注册了 `run`、`serve`、`debug` 等子命令。这些我们会在阶段 8（CLI 入口）实现。

## 工程思维总结

阶段 0 你学到的不只是语法，更是一些工程思维：

### 1. 运行时和类型检查是分开的

Python 里你习惯了 `python script.py` 既能跑也能报类型错误（运行时）。但 TS 世界里：

- **Bun**（运行时）：执行代码，不管类型标注
- **tsc**（类型检查器）：扫描代码找类型错误，不执行代码

这就是为什么需要两套配置（package.json 给 Bun，tsconfig.json 给 tsc）、两个命令（`bun run dev` 运行，`bun run typecheck` 检查）。

> 工程思维：**关注点分离**。运行和检查是两个不同的关注点，用不同工具处理。Python 把它们混在一起（运行时也能抛 TypeError），TS 把它们拆开了。

### 2. 配置文件是"项目的契约"

package.json 和 tsconfig.json 不只是配置——它们是**项目的契约**：

- package.json 声明"这个项目依赖什么、怎么跑"
- tsconfig.json 声明"这个项目用什么 TS 规则"
- bun.lock 锁定"每个人装的依赖版本完全一致"

新人 clone 项目后，`bun install` + `bun run dev` 就能跑起来，不用问任何人。这就是配置文件的价值。

> 工程思维：**让项目自描述**。好的项目不需要 README 写一堆"先装这个再装那个"，配置文件本身就是说明。

### 3. 先跑通再完善

我们的 index.ts 只有一行 `console.log`，但它验证了整条工具链通了：Bun 能跑、TS 能检查、VSCode 能调试。后续阶段往里加 LLM 调用、工具系统、session 管理时，基础是可靠的。

> 工程思维：**先建立可工作的最小闭环，再逐步加功能**。不要一上来就写复杂代码，先确保"写代码 → 运行 → 调试"这条路通。

## 阶段 0 学了什么

| 课 | 知识点 | Python 类比 |
|----|--------|-------------|
| 0.1 | Bun 运行时 + console.log + 读报错 | python + print + traceback |
| 0.2 | TypeScript 类型系统初步 | type hints |
| 0.3 | import/export 模块系统 | import |
| 0.4 | package.json + 依赖管理 | pyproject.toml + pip |
| 0.5 | tsconfig.json + 类型检查 | mypy.ini + mypy |
| 0.6 | VSCode 断点调试 | pdb / PyCharm 调试器 |

你现在是"能写 TS、能跑、能调试"的状态。下一步要开始真正构建 agent 了。

---

下一步：[阶段 1：最小 Agent](../../01-minimal-agent/) —— 用 fetch 直接调 LLM API。


---

