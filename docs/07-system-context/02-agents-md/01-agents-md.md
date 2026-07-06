# 7.2 AGENTS.md 加载：项目指令

> 本课目标：实现 AGENTS.md 文件加载，从项目根目录读取项目指令，拼入 system prompt。

## AGENTS.md 是什么

AGENTS.md 是给 AI 的**项目指令文件**——告诉 AI 这个项目的规则、约定、注意事项。

比如我们项目根目录就有一个 `AGENTS.md`，里面写了：
- 项目概述（从零复刻 opencode）
- 开发约定（代码风格、git 规范）
- 给 AI 助手的指令（奥卡姆剃刀、渐进式复杂度等）

> 你可以现在打开 `AGENTS.md` 看看——这就是你给 AI 的"操作手册"。

AGENTS.md 是**自由格式 markdown**，没有 schema，没有必填项。AI 直接当文本读，不需要解析结构。

## opencode 怎么搜索 AGENTS.md

opencode 的搜索逻辑在 `session/instruction.ts`，分三层：

### 1. 全局 AGENTS.md

```
~/.config/opencode/AGENTS.md
```

全局指令，所有项目共享。找到就用，不再找全局的 `CLAUDE.md`。

### 2. 项目 AGENTS.md（findUp 搜索）

从当前工作目录开始，**向上**逐级查找，直到工作区根目录。每一级的 `AGENTS.md` 都收集：

```
工作目录: /Users/hongkailan/project/packages/core
向上找:
  /Users/hongkailan/project/packages/core/AGENTS.md  ← 找到，收集
  /Users/hongkailan/project/packages/AGENTS.md       ← 如果有，也收集
  /Users/hongkailan/project/AGENTS.md                ← 如果有，也收集
  /Users/hongkailan/AGENTS.md                        ← 超出工作区根，停止
```

> **为什么要 findUp？** 大项目有子目录层级。`packages/core/AGENTS.md` 可以写 core 包的特殊规则，根目录 `AGENTS.md` 写全局规则。AI 同时看到两层，先具体后通用。

### 3. 配置文件指定的额外指令

`opencode.json` 里的 `instructions` 字段可以指定额外的文件路径或 URL。

### 搜索优先级

```
全局 AGENTS.md（~/.config/opencode/AGENTS.md）
    ↓
项目 AGENTS.md（findUp 从 cwd 到 workspace root，全部收集）
    ↓
配置文件 instructions（URL 或额外路径）
```

每个文件的内容前面加上 `Instructions from: <路径>`，然后拼在一起。

## 我们的简化版

我们只实现项目 AGENTS.md 的 findUp 搜索，不做全局和配置文件（后续补全）：

```ts
// 从当前目录向上找 AGENTS.md，收集所有找到的
function findAgentsMd(startDir: string): string[] {
  const results: string[] = []
  let current = startDir
  while (true) {
    const filePath = join(current, "AGENTS.md")
    if (existsSync(filePath)) {
      results.push(filePath)
    }
    const parent = dirname(current)
    if (parent === current) break  // 到达根目录
    current = parent
  }
  return results
}
```

然后读取每个文件，拼入 system prompt：

```
system prompt = 角色定义 + 环境信息 + AGENTS.md 内容
```

## 代码改动

`src/system-context.ts` 加两个函数：
1. `findAgentsMd(startDir)`：findUp 搜索
2. `loadInstructions()`：读取所有 AGENTS.md，拼接成字符串

`buildSystemPrompt()` 改为：角色 + 环境 + 指令。

## 运行

```bash
bun run src/index.ts
```

我们的项目根目录有 `AGENTS.md`，启动后 AI 会自动读取它。你可以问 AI "这个项目的开发约定是什么" 来验证。

### 调试模式

```bash
DEBUG_INPUTS='["这个项目用了什么技术栈？"]' bun run src/index.ts
```

AI 应该能回答 Bun、TypeScript、Effect-TS 等——这些信息来自 `AGENTS.md`。

## 对照 opencode

| | 我们的实现 | opencode |
|---|-----------|----------|
| 搜索范围 | findUp 从 cwd 到根目录 | findUp 从 cwd 到 workspace root |
| 全局 AGENTS.md | 不支持 | `~/.config/opencode/AGENTS.md` |
| CLAUDE.md 兼容 | 不支持 | 支持（可关闭） |
| 配置文件 instructions | 不支持 | 支持 URL 和额外路径 |
| 文件前缀 | `Instructions from: <path>` | 同样 |
| 组装时机 | 每次启动 | 每次 LLM 调用（每轮重新读） |

> opencode 每轮 LLM 调用都重新读 AGENTS.md——这样修改文件后下一轮就生效。我们目前只在启动时读一次，7.3 课会讨论是否需要改成每轮读。

## 本课小结

1. **AGENTS.md** 是给 AI 的项目指令文件，自由格式 markdown
2. **findUp 搜索**：从当前目录向上逐级查找，收集所有 AGENTS.md
3. **拼接**：每个文件内容前加 `Instructions from: <path>`，拼入 system prompt
4. **opencode 多三层**：全局 AGENTS.md + CLAUDE.md 兼容 + 配置文件 instructions
5. **大项目多层级**：子目录的 AGENTS.md 可以写特殊规则，根目录的写全局规则

下一步：[7.3 对照 opencode + 阶段验收](../03-stage-review/) —— 完整 system context 管线对比。
