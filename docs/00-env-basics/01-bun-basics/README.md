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

> 如果没装，macOS 上用 `brew install oven-sh/bun/bun` 或 `curl -fsSL https://bun.sh/install | bash`。

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
