# 4.4 工具输出截断 + 阶段验收

> 本课目标：实现工具输出截断（防止撑爆 LLM 上下文），验收阶段 4 全部工具。

## 为什么要截断

想象这个场景：LLM 调 bash 执行 `cat node_modules/typescript/package.json`，输出 50000 行。这 50000 行全部作为 `role: "tool"` 消息加入 messages，下次请求时全部发给 LLM——直接撑爆上下文窗口，API 报错或费用暴增。

**工具输出必须截断。** opencode 的做法：

```ts
// opencode/packages/opencode/src/tool/truncate.ts:15-16
export const MAX_LINES = 2000    // 最多 2000 行
export const MAX_BYTES = 50 * 1024  // 最多 50KB
```

超限时，opencode 把完整输出写到临时文件，只把前面一部分 + 提示信息喂回 LLM。

## 实现截断函数

我们实现简化版——超限时保留开头和结尾，中间用省略号代替：

```ts
// src/tool/truncate.ts
const MAX_LINES = 2000
const MAX_BYTES = 50 * 1024  // 50KB

export function truncate(text: string): string {
  const lines = text.split("\n")

  // 1. 行数超限：保留前半 + 后半
  if (lines.length > MAX_LINES) {
    const half = Math.floor(MAX_LINES / 2)
    const head = lines.slice(0, half)
    const tail = lines.slice(-half)
    return [
      ...head,
      `... (省略 ${lines.length - MAX_LINES} 行) ...`,
      ...tail,
    ].join("\n")
  }

  // 2. 字节数超限：直接截断
  if (text.length > MAX_BYTES) {
    return text.slice(0, MAX_BYTES) + `\n... (输出过长，已截断，共 ${text.length} 字节)`
  }

  return text
}
```

关键设计：

1. **保留开头和结尾**——开头通常是最重要的信息，结尾可能有错误提示
2. **行数优先**——先检查行数，再检查字节数
3. **省略提示**——告诉 LLM 有多少内容被省略了

> 对照 opencode：它把完整输出写到临时文件，LLM 可以用 read 工具读那个文件看完整内容。我们简化版只做截断，不做临时文件（后续阶段补）。

## 在哪里应用截断

截断应该在**所有工具的输出**上应用。最简单的方式：在 index.ts 的 tool loop 里，工具执行后截断结果：

```ts
// 执行工具
const output = await tool.execute(args)

// 截断后喂回 LLM
messages.push({
  role: "tool",
  tool_call_id: tc.id,
  content: truncate(output),  // ← 截断
})
```

> 对照 opencode：它的截断在 `tool/tool.ts` 的 `wrap()` 函数里——每个工具的 execute 都被自动包装，不用手动调。我们简化版在 tool loop 里手动调。

## 阶段验收

### 验收清单

```bash
# 1. 类型检查
bun run typecheck

# 2. 全部工具能跑
bun run src/index.ts
# read: "src/index.ts 里写了什么？"
# write: "创建一个 test.txt，内容是 hello"
# edit: "把 test.txt 里的 hello 改成 world"
# bash: "当前目录有哪些文件？"
# glob: "找出所有 .ts 文件"
# grep: "搜索包含 chatStream 的代码"
```

| 验收项 | 状态 |
|--------|------|
| read 工具（读文件） | ✓ |
| write 工具（写文件） | ✓ |
| edit 工具（编辑文件） | ✓ |
| bash 工具（执行命令） | ✓ |
| glob 工具（文件名搜索） | ✓ |
| grep 工具（内容搜索） | ✓ |
| 输出截断 | ✓ |
| tool loop（多工具协作） | ✓ |

### 项目结构

```
src/
├── index.ts              # 入口：多轮对话 + tool loop + 截断
├── llm.ts                # LLM 客户端：chatWithTools
├── types.ts              # 类型定义
└── tool/
    ├── tool.ts           # Tool 接口 + toolToOpenAIFormat
    ├── truncate.ts       # 新增：输出截断
    ├── read.ts + read.txt
    ├── write.ts + write.txt
    ├── edit.ts + edit.txt
    ├── bash.ts + bash.txt
    ├── glob.ts + glob.txt
    └── grep.ts + grep.txt
```

## 工程思维总结

### 1. 声明式工具定义的扩展性

阶段 3 我们定义了 Tool 接口和 tool loop。阶段 4 加了 5 个工具（write、edit、bash、glob、grep），**tool loop 代码一行没改**。只需要：

1. 定义 Tool 对象（id + description + parameters + execute）
2. 加入 tools 数组

这就是声明式设计的好处——**加功能不改框架**。opencode 也是这个模式，它的 ToolRegistry 管理所有工具，runLoop 只管循环。

### 2. 工具协作

单个工具能力有限，组合起来就很强大：

```
glob 找文件 → read 读内容 → edit 修改 → bash 运行测试 → grep 验证结果
```

LLM 自己决定用什么工具、什么顺序。你只提供工具，不写流程。这就是 agent 和脚本的区别——**脚本是你写流程，agent 是 LLM 写流程**。

### 3. 输出截断：防御性编程

工具输出可能很大（大文件、长命令输出）。不截断会撑爆 LLM 上下文。这是**防御性编程**——假设输入可能异常大，提前处理。

> opencode 的截断更完善——写临时文件 + LLM 可以 read 完整内容。但核心思路一样：**不要把无限大的数据喂给 LLM**。

## 阶段 4 学了什么

| 课 | 知识点 |
|----|--------|
| 4.1 | write（Bun.write）、edit（精确字符串替换 + replaceAll） |
| 4.2 | bash（Bun.spawn 执行命令、捕获 stdout/stderr、超时） |
| 4.3 | glob（Bun.Glob 文件名匹配）、grep（正则内容搜索） |
| 4.4 | 输出截断（MAX_LINES/MAX_BYTES、保留首尾） |

你现在是"能用工具的 agent"状态——能读写文件、执行命令、搜索代码。下一步是让对话能持久化——重启程序后恢复之前的对话。

---

下一步：[阶段 5：Session 持久化](../../05-session-persist/) —— SQLite + Drizzle，对话历史存数据库。
