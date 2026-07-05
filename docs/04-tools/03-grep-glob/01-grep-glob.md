# 4.3 grep + glob：搜索工具

> 本课目标：实现 glob（按文件名模式找文件）和 grep（按内容搜索），让 agent 能搜索代码。

## 两个搜索工具的区别

| | glob | grep |
|---|------|------|
| 搜什么 | 文件**名** | 文件**内容** |
| 怎么搜 | 通配符模式（`**/*.ts`） | 正则表达式（`function\s+\w+`） |
| 返回 | 文件路径列表 | 文件路径 + 行号 + 匹配行 |
| 场景 | "找出所有 .ts 文件" | "找出包含 console.log 的行" |
| Python 类比 | `glob.glob("**/*.ts")` | `grep -r "pattern" .` |

它们经常配合使用：glob 找到文件 → read 读内容 → edit 修改。

## glob 工具

### Bun.Glob

Bun 内置了 `Glob` 类，支持通配符模式匹配文件：

```ts
const glob = new Bun.Glob("**/*.ts")
for await (const path of glob.scan(".")) {
  console.log(path)  // src/index.ts, src/llm.ts, ...
}
```

通配符语法：

| 模式 | 匹配 | 例子 |
|------|------|------|
| `*` | 单层任意字符 | `*.ts` → src 目录下的 .ts 文件 |
| `**` | 递归任意层 | `**/*.ts` → 所有子目录的 .ts 文件 |
| `{a,b}` | 多选一 | `*.{ts,tsx}` → .ts 或 .tsx 文件 |
| `?` | 单个任意字符 | `?.ts` → a.ts, b.ts |

> 类比 Python：`glob.glob("**/*.ts", recursive=True)`，语法几乎一样。

### 实现

```ts
async function execute(args) {
  const pattern = args.pattern as string
  const glob = new Bun.Glob(pattern)
  const paths: string[] = []

  // scan(".") 从当前目录递归扫描
  for await (const path of glob.scan(".")) {
    paths.push(path)
  }

  if (paths.length === 0) return "没有找到匹配的文件"
  return paths.join("\n")
}
```

## grep 工具

### 搜索逻辑

grep 工具遍历文件，用正则表达式匹配每行内容：

```ts
async function execute(args) {
  const pattern = args.pattern as string   // 正则表达式
  const include = args.include as string   // 文件过滤（如 "*.ts"）

  const regex = new RegExp(pattern, "i")   // 编译正则
  const results: string[] = []

  // 1. 用 glob 找到要搜索的文件
  const globPattern = include || "**/*"
  const glob = new Bun.Glob(globPattern)

  for await (const filePath of glob.scan(".")) {
    // 跳过 node_modules 和 opencode 目录
    if (filePath.startsWith("node_modules") || filePath.startsWith("opencode")) continue

    // 2. 读文件内容
    const file = Bun.file(filePath)
    const text = await file.text()
    const lines = text.split("\n")

    // 3. 逐行匹配
    for (let i = 0; i < lines.length; i++) {
      if (regex.test(lines[i])) {
        results.push(`${filePath}:${i + 1}: ${lines[i].trim()}`)
      }
    }
  }

  if (results.length === 0) return "没有找到匹配的内容"
  return results.join("\n")
}
```

关键点：

1. **正则编译**：`new RegExp(pattern, "i")` 编译正则（`i` 表示不区分大小写）
2. **glob 过滤**：`include` 参数限定搜索哪些文件（如只搜 `.ts` 文件）
3. **跳过目录**：`node_modules` 和 `opencode` 不搜（太大、不相关）
4. **输出格式**：`文件路径:行号: 匹配行`（和 ripgrep 一样）

> 对照 opencode：它的 grep 工具（`tool/grep.ts`）底层用的是 `ripgrep`（rg 命令），比我们的逐行扫描快得多。我们先用纯 TS 实现，后续可以优化为调 ripgrep。

### RegExp：正则表达式

TS 的正则和 Python 一样：

```ts
// TS
const regex = new RegExp("function\\s+\\w+", "i")
// 或字面量写法
const regex = /function\s+\w+/i

regex.test("function foo()")  // true
```

```python
# Python
import re
regex = re.compile(r"function\s+\w+", re.IGNORECASE)
regex.search("function foo()")  # 匹配
```

| | TS | Python |
|---|-----|--------|
| 创建 | `new RegExp("pattern", "i")` 或 `/pattern/i` | `re.compile("pattern", re.I)` |
| 测试 | `regex.test(str)` | `regex.search(str)` |
| 标志 | `i` 不区分大小写, `g` 全局 | `re.I`, `re.MULTILINE` 等 |

## 工具协作

glob 和 grep 经常配合使用：

```
用户：找出所有包含 chatStream 的 TypeScript 文件
    │
    ▼
LLM 调 grep({ pattern: "chatStream", include: "*.ts" })
    │
    ▼
返回：src/llm.ts:64: export async function chatStream(
      src/index.ts:5: import { loadConfig, chatStream } from "./llm"
    │
    ▼
LLM 调 read({ filePath: "src/llm.ts" })  // 读完整文件
    │
    ▼
LLM 回答用户问题
```

## 注册工具

```ts
import { globTool } from "./tool/glob"
import { grepTool } from "./tool/grep"

const tools: Tool[] = [readTool, writeTool, editTool, bashTool, globTool, grepTool]
```

tool loop 不用改。

## 跑起来

试试：
- "找出所有 .ts 文件"
- "搜索代码里包含 chatStream 的地方"

## 本课小结

1. **glob**：按文件名模式匹配（`**/*.ts`），用 `Bun.Glob` 扫描
2. **grep**：按内容正则搜索，遍历文件逐行匹配
3. **工具协作**：glob 找文件 → grep 搜内容 → read 读文件 → edit 修改
4. **RegExp**：TS 正则和 Python 一样，`new RegExp(pattern, "i")` 或 `/pattern/i`

下一步：[4.4 工具输出截断 + 阶段验收](../04-truncate-review/01-truncate-review.md)。
