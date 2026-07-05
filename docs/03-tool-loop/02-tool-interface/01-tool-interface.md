# 3.2 定义 Tool 接口 + 实现 read 工具

> 本课目标：定义我们的 Tool 接口，实现 read 工具（读文件返回带行号的文本），把工具定义转成 OpenAI API 的 tools 格式。

## 回顾 3.1 课

上一课我们学了 OpenAI API 的 tool calling 格式：请求里加 `tools` 字段，LLM 返回 `tool_calls`，执行后把结果以 `role: "tool"` 喂回。

但 tools 字段里的工具定义是手写的 JSON。现在我们要用 TS 代码定义工具，让程序自动生成这个 JSON。

## 定义 Tool 接口

先定义我们的工具接口。看 [`src/tool/tool.ts`](../../../src/tool/tool.ts)：

```ts
// 一个工具的定义
export interface Tool {
  id: string                    // 工具名（LLM 用这个名字调用，如 "read"）
  description: string           // 工具说明（LLM 根据这个决定要不要用）
  parameters: JSONSchema        // 参数格式（JSON Schema，告诉 LLM 参数结构）
  execute(args: Record<string, unknown>): Promise<string>  // 执行函数，返回文本结果
}
```

和 3.1 课的 OpenAI API 格式对照：

| OpenAI API 字段 | 我们的 Tool 字段 |
|-----------------|-----------------|
| `function.name` | `id` |
| `function.description` | `description` |
| `function.parameters` | `parameters` |
| —（API 没有这个） | `execute`（你的程序执行，不发给 LLM） |

### JSONSchema 类型

`parameters` 字段的类型是 `JSONSchema`——就是 3.1 课看到的参数格式：

```ts
// JSON Schema 的简化类型定义
export interface JSONSchema {
  type: string                              // "object" / "string" / "number" 等
  properties?: Record<string, JSONSchema>   // 对象的属性（每个属性又是一个 JSONSchema）
  required?: string[]                       // 必填字段列表
  description?: string                      // 字段说明（LLM 看的）
}
```

### 把 Tool 转成 OpenAI API 格式

LLM 需要的 tools 格式是 `{type: "function", function: {name, description, parameters}}`。写个函数做转换：

```ts
// 把我们的 Tool 定义转成 OpenAI API 的 tools 格式
export function toolToOpenAIFormat(tool: Tool) {
  return {
    type: "function" as const,
    function: {
      name: tool.id,
      description: tool.description,
      parameters: tool.parameters,
    },
  }
}
```

> 这个函数就是把 Tool 的字段重新包装成 API 需要的嵌套结构。3.3 课发请求时会用到它。

## 实现 read 工具

read 工具是最简单的工具——读文件，返回带行号的文本。看 [`src/tool/read.ts`](../../../src/tool/read.ts)。

### 工具描述

先写 LLM 看的说明文本。看 [`src/tool/read.txt`](../../../src/tool/read.txt)：

```
读取本地文件内容，返回带行号的文本。
参数 filePath 是文件路径（相对路径或绝对路径）。
每行格式为 "行号: 内容"，例如 "1: console.log("hello")"。
```

> 对照 opencode：它的 `read.txt` 有 14 行，更详细（包括 offset/limit 参数说明、和 grep/glob 的配合等）。我们先用简化版，后续阶段补全。

### 参数定义

read 工具只需要一个参数：文件路径。

```ts
const parameters: JSONSchema = {
  type: "object",
  properties: {
    filePath: {
      type: "string",
      description: "要读取的文件路径",
    },
  },
  required: ["filePath"],
}
```

### execute 函数

执行逻辑：读文件 → 加行号 → 返回文本。

```ts
async function execute(args: Record<string, unknown>): Promise<string> {
  const filePath = args.filePath as string

  // 读文件（Bun 内置的文件读取）
  const file = Bun.file(filePath)
  const exists = await file.exists()
  if (!exists) {
    return `错误：文件 ${filePath} 不存在`
  }

  const text = await file.text()
  const lines = text.split("\n")

  // 加行号：每行格式 "行号: 内容"（和 opencode 一样）
  const numbered = lines
    .map((line, i) => `${i + 1}: ${line}`)
    .join("\n")

  return numbered
}
```

> 对照 opencode：它的 read 工具（`tool/read.ts`）复杂得多——有 offset/limit 分页、二进制检测、图片/PDF 处理、权限检查、外部目录限制、单行截断、字节上限等。我们先用最简版，后续阶段逐步补全。

### 完整的 read 工具定义

```ts
import type { Tool } from "./tool"
import type { JSONSchema } from "./tool"

export const readTool: Tool = {
  id: "read",
  description: DESCRIPTION,  // 从 read.txt 导入
  parameters,
  execute,
}
```

> `import DESCRIPTION from "./read.txt"`——Bun 原生支持把 `.txt` 文件当字符串导入。opencode 也是这么做的。

## 跑一下

看教学代码 [`src/tool-demo.ts`](../../../src/tool-demo.ts)，直接调用 read 工具读自己的文件：

```bash
bun run src/tool-demo.ts
```

期望输出 read 工具读到的文件内容（带行号）。

## 对照 opencode

| | 我们的 read | opencode 的 read |
|---|------------|------------------|
| 参数 | `filePath` | `filePath` + `offset` + `limit` |
| 行号格式 | `1: 内容` | `1: 内容`（一样） |
| 分页 | 无 | offset/limit，默认 2000 行 |
| 二进制检测 | 无 | 扩展名黑名单 + 不可打印字符比例 |
| 图片/PDF | 无 | 转 base64 作为附件返回 |
| 权限检查 | 无 | `ctx.ask({ permission: "read" })` |
| 截断 | 无 | 单行 2000 字符、总 50KB 上限 |
| 输出格式 | `<path>\n<type>\n<content>` | `<path>\n<type>\n<content>`（一样） |

> 这些差异是**有意的简化**。我们先用最简版跑通工具循环，后续阶段逐步补全到和 opencode 一致。

## 本课小结

1. **Tool 接口**：`{id, description, parameters, execute}`——id/description/parameters 发给 LLM，execute 是你的程序执行
2. **JSON Schema**：描述参数格式的标准，LLM 看了它知道怎么传参数
3. **toolToOpenAIFormat**：把 Tool 转成 OpenAI API 的 `{type: "function", function: {...}}` 格式
4. **read 工具**：读文件 → 加行号 → 返回文本
5. **.txt 导入**：Bun 支持 `import DESCRIPTION from "./read.txt"`，把文本文件当字符串导入
6. **对照 opencode**：我们的 read 是简化版，后续阶段补全 offset/limit/截断/权限等

下一步：[3.3 实现 tool loop](../03-tool-loop/01-tool-loop.md) —— 把工具接入 LLM，实现检测 tool_calls → 执行 → 喂回 → 循环。
