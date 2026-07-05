# 4.1 write + edit：文件写入与编辑

> 本课目标：实现 write 工具（写文件）和 edit 工具（精确字符串替换），让 agent 能修改文件。

## 为什么要先 read 再 write/edit

opencode 的 write.txt 和 edit.txt 都有一条规则：**编辑前必须先 read**。为什么？

因为 LLM 可能"幻觉"——以为文件内容是什么，但实际不是。先 read 确保 LLM 看到真实内容再改。我们的简化版暂不强制检查（后续阶段补），但工具描述里会写这条规则，引导 LLM 遵守。

## write 工具

write 工具：把内容写到文件。如果文件已存在，覆盖。

### 参数

```ts
{
  type: "object",
  properties: {
    filePath: { type: "string", description: "文件路径" },
    content: { type: "string", description: "要写入的完整内容" },
  },
  required: ["filePath", "content"],
}
```

### execute

```ts
async function execute(args) {
  const filePath = args.filePath as string
  const content = args.content as string

  // Bun.write：写文件（不存在则创建，存在则覆盖）
  await Bun.write(filePath, content)

  return `已写入 ${filePath}（${content.length} 字符）`
}
```

> `Bun.write` 类比 Python 的 `open(path, "w").write(content)`——不存在则创建，存在则覆盖。

## edit 工具

edit 工具：精确字符串替换。找到 `oldString`，替换成 `newString`。

### 参数

```ts
{
  type: "object",
  properties: {
    filePath: { type: "string", description: "文件路径" },
    oldString: { type: "string", description: "要替换的原文（必须精确匹配）" },
    newString: { type: "string", description: "替换后的新文本" },
    replaceAll: { type: "boolean", description: "是否替换所有匹配（默认 false）" },
  },
  required: ["filePath", "oldString", "newString"],
}
```

### execute

```ts
async function execute(args) {
  const filePath = args.filePath as string
  const oldString = args.oldString as string
  const newString = args.newString as string
  const replaceAll = args.replaceAll as boolean | undefined

  // 1. 读文件
  const file = Bun.file(filePath)
  const exists = await file.exists()
  if (!exists) return `错误：文件 ${filePath} 不存在`

  const content = await file.text()

  // 2. 检查 oldString 是否存在
  if (!content.includes(oldString)) {
    return `错误：在 ${filePath} 中找不到 oldString`
  }

  // 3. 检查是否有多处匹配（非 replaceAll 模式下报错）
  if (!replaceAll) {
    const firstIndex = content.indexOf(oldString)
    const secondIndex = content.indexOf(oldString, firstIndex + 1)
    if (secondIndex !== -1) {
      return `错误：在 ${filePath} 中找到多处匹配，请提供更多上下文或使用 replaceAll`
    }
  }

  // 4. 替换并写回
  const newContent = replaceAll
    ? content.split(oldString).join(newString)  // 替换所有
    : content.replace(oldString, newString)     // 只替换第一个

  await Bun.write(filePath, newContent)

  return `已编辑 ${filePath}`
}
```

关键设计：

1. **oldString 必须精确匹配**——包括空格、换行、缩进。这强制 LLM 先 read 看到真实内容
2. **多处匹配时报错**——除非 `replaceAll: true`。这防止意外改错地方
3. **替换后写回**——读 → 改 → 写，整个文件重新写入

> 对照 opencode：它的 edit 工具（`tool/edit.ts`）也是这个逻辑——oldString 精确匹配、多处匹配报错、replaceAll 选项。它的错误信息和我们一样：`"oldString not found in content"` 和 `"Found multiple matches"`。

### replaceAll 的用法

```ts
// 替换第一个匹配（默认）
edit({ filePath: "a.ts", oldString: "foo", newString: "bar" })

// 替换所有匹配
edit({ filePath: "a.ts", oldString: "foo", newString: "bar", replaceAll: true })
```

> `replaceAll` 用于重命名变量等场景——文件里有 10 个 `foo`，全改成 `bar`。

## 为什么不用正则替换

edit 工具用**精确字符串匹配**，不用正则表达式。为什么？

1. **安全**：正则可能意外匹配到不该改的地方（比如 `.*` 匹配整个文件）
2. **可预测**：LLM 看到什么就改什么，不会有意外
3. **简单**：不需要 LLM 写正确的正则（这很难）

> opencode 的 edit 工具也是精确匹配。正则搜索留给 grep 工具（4.3 课）。

## 注册工具

在 `index.ts` 里把 write 和 edit 加入 tools 数组：

```ts
import { readTool } from "./tool/read"
import { writeTool } from "./tool/write"
import { editTool } from "./tool/edit"

const tools: Tool[] = [readTool, writeTool, editTool]
```

**tool loop 不用改任何代码**——这就是声明式工具定义的好处：加工具只需要定义 Tool 对象 + 注册，tool loop 自动处理。

## 跑起来

```bash
bun run src/index.ts
```

试试：
- "在 src/ 下创建一个 test.txt，内容是 hello"
- "把 src/index.ts 里的 AI 助手 改成 OpenCode Agent"

## 对照 opencode

| | 我们的 write | opencode 的 write |
|---|-------------|-------------------|
| 参数 | filePath + content | filePath + content |
| 检查先 read | 无（描述里提示） | 有（强制报错） |
| 截断 | 无 | 无（写入不截断） |

| | 我们的 edit | opencode 的 edit |
|---|------------|------------------|
| 匹配方式 | 精确字符串 | 精确字符串 |
| 多处匹配 | 报错（除非 replaceAll） | 报错（除非 replaceAll） |
| 检查先 read | 无 | 有（强制报错） |
| 错误信息 | 中文 | 英文（`oldString not found`） |

## 本课小结

1. **write 工具**：`Bun.write` 写文件，不存在则创建，存在则覆盖
2. **edit 工具**：精确字符串替换（oldString → newString），多处匹配报错（除非 replaceAll）
3. **为什么精确匹配**：安全、可预测、强制 LLM 先 read
4. **声明式扩展**：加工具只改 tools 数组，tool loop 不用改

下一步：[4.2 bash 工具](../02-bash/01-bash.md) —— 执行 shell 命令。
