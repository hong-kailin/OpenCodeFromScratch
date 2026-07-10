# 9.5 工具调用展示：spinner 执行中 -> 结果完成

> 本课目标：把工具调用从"两条独立消息"改成"一个有状态的单体"--执行中转 spinner 动画，完成后切换成 ✓ + 结果。这是阶段 9 的最后一课。

## 要解决什么问题

9.4 课的工具调用显示效果：

```
你: 帮我读一下 src/index.ts
🔧 调用 read({"filePath":"src/index.ts"})
🔧 结果: // src/index.ts\nimport yargs from "yargs"...
AI: 这个文件是项目的入口...
```

问题：

1. **调用和结果是两条独立消息**，分不清谁是谁的结果。LLM 连续调 3 个工具就变成 6 条消息排成一列。
2. **没有"执行中"状态**。工具执行可能要几秒，这段时间用户只看到一条静态文本，不知道是在跑还是卡住了。
3. **信息重复**。"调用 read(...)" 和 "结果: ..." 里工具名、参数都重复了一遍。

opencode 的做法是：**每个工具调用是一个有状态的单体（ToolPart）**，状态从 `pending` -> `running`（显示 spinner）-> `completed`（显示 ✓ + 结果）。整个过程在一条记录里完成状态切换，而不是新增两条消息。

我们要实现的效果：

```
你: 帮我读一下 src/index.ts
⠋ read({"filePath":"src/index.ts"})     ← 执行中：spinner 转圈
✓ read({"filePath":"src/index.ts"})     ← 完成后：spinner 消失，变 ✓
  // src/index.ts\nimport yargs from...   ← 结果预览
AI: 这个文件是项目的入口...
```

## 核心难点：怎么关联"开始调用"和"得到结果"

回忆 9.4 课的回调接口（`src/agent-loop.ts`）：

```ts
export interface LoopCallbacks {
  onChunk: (text: string) => void
  onToolCall: (name: string, args: string) => void   // 开始调用
  onToolResult: (output: string) => void              // 得到结果
}
```

`onToolCall` 和 `onToolResult` 是**两次独立的回调调用**，中间隔着 `await tool.execute(args)`（可能几秒）。如果 `onToolCall` 新增了一条"执行中"的消息，`onToolResult` 怎么找到那条消息并更新成"已完成"？

**不能靠顺序**。虽然现在串行执行，但靠"第 N 个 onToolCall 对应第 N 个 onToolResult"很脆弱--一旦改成并发执行就崩了。

**opencode 的解法**：每次工具调用有个唯一标识 `callID`（来自 LLM 返回的 `tool_call.id`），两个回调都带上它，用 id 关联。我们照搬这个思路，改接口：

```ts
export interface LoopCallbacks {
  onChunk: (text: string) => void
  // id 是这次工具调用的唯一标识（来自 LLM 返回的 tool_call.id）
  onToolCall: (id: string, name: string, args: string) => void
  // id 对应 onToolCall 时的 id，调用方据此找到"执行中"的记录并更新
  onToolResult: (id: string, output: string) => void
}
```

然后在 `runAgentLoop` 里把 LLM 返回的 `tc.id` 透传过去（见 `src/agent-loop.ts:46-57`）：

```ts
for (const tc of result.toolCalls) {
  const tool = tools.find((t) => t.id === tc.function.name)
  callbacks.onToolCall(tc.id, tc.function.name, tc.function.arguments)
  // ... await tool.execute(args) ...
  callbacks.onToolResult(tc.id, output)
}
```

> **Python 类比**：像数据库外键关联。`onToolCall` 插入一行（id=abc, status=running），`onToolResult` 用 `WHERE id=abc` 找到那行更新成 completed。id 是关联的"键"。

## 数据结构：给 ChatMessage 加状态字段

9.4 课的 `ChatMessage` 是扁平的，工具调用和结果都塞进 `content`。现在要让一条工具消息自己持有"状态"（`src/tui/agent.tsx`）：

```ts
interface ChatMessage {
  role: "user" | "assistant" | "tool"
  content: string
  // 以下字段仅 role === "tool" 时使用
  toolName?: string                       // 工具名，如 "read"
  toolArgs?: string                       // 参数 JSON 字符串
  toolStatus?: "running" | "completed"    // 执行状态
}
```

### 为什么用可选字段而不是联合类型？

opencode 用严格的 discriminated union（判别联合）：`{ status: "running"; ... } | { status: "completed"; output: string; ... }`。TypeScript 能根据 `status` 自动收窄类型，更安全。但它在 TSX 里有个麻烦：`<Show when={msg.role === "tool"}>` 这种条件渲染**不会**自动帮 TypeScript 收窄 `msg` 的类型，访问 `msg.toolName` 会报错，得手动 `as` 断言。

对一个刚接触 TypeScript 的学习者，这里引入判别联合 + TSX 类型收窄是个干扰。所以用**可选字段**（`toolName?`）简化：`msg.content` 永远存在，工具专属字段可选，TSX 里不用断言就能访问。代价是类型不严格（user 消息也能写 `toolName` 而编译器不报错），但运行时只有 tool 消息填这些字段。这是典型的"用类型安全换可读性"的 trade-off，后续补全到 opencode 一致时再改成联合类型。

## 回调实现：新增"执行中" + 原地更新"已完成"

```ts
// 工具开始调用：新增一条 status=running 的工具消息
onToolCall(id, name, args) {
  setMessages((prev) => [
    ...prev,
    { role: "tool", content: "", toolName: name, toolArgs: args, toolStatus: "running" },
  ])
},
// 工具执行完毕：找到那条"执行中"的记录，更新为"已完成"并填入结果
onToolResult(id, output) {
  setMessages((prev) =>
    prev.map((msg) =>
      msg.role === "tool" && msg.toolStatus === "running"
        ? { ...msg, toolStatus: "completed", content: output }
        : msg,
    ),
  )
},
```

注意三个点：

1. **`onToolCall` 新增一条消息**，`toolStatus: "running"`，`content` 暂时空着。
2. **`onToolResult` 不新增消息**，而是用 `.map()` 遍历，找到那条 `running` 的工具消息，原地更新成 `completed` 并填入 `content`。
3. **`id` 参数暂时没用上**？是的--因为串行执行时同一时刻最多只有一条 `running` 的工具消息，靠 `toolStatus === "running"` 就能匹配。`id` 是为将来支持并发执行预留的（多个工具同时跑时，靠 `msg.id === id` 精确匹配）。

> **工程思维**：接口设计要考虑未来扩展（带上 id），但实现可以先简化（串行时靠状态匹配）。等真正需要并发时，只改 `onToolResult` 里的匹配条件，接口不用动。这叫"前向兼容"。

## 渲染：spinner 动画 -> ✓ 结果

最关键的部分。工具消息的渲染按 `toolStatus` 分两态（`src/tui/agent.tsx`）：

```tsx
<Show
  when={msg.toolStatus === "running"}
  fallback={
    // 已完成：✓ + 工具名(参数)
    <box flexDirection="row" gap={1}>
      <text fg="green">✓</text>
      <text fg="gray">{msg.toolName}({msg.toolArgs})</text>
    </box>
  }
>
  {/* 执行中：spinner 动画 + 工具名(参数) */}
  <box flexDirection="row" gap={1}>
    <spinner frames={SPINNER_FRAMES} interval={80} />
    <text fg="yellow">{msg.toolName}({msg.toolArgs})</text>
  </box>
</Show>
{/* 结果预览：完成时才显示，截断到 200 字符 */}
<Show when={msg.toolStatus === "completed" && msg.content}>
  <text fg="gray" paddingLeft={2}>
    {msg.content.length > RESULT_PREVIEW_LEN
      ? msg.content.slice(0, RESULT_PREVIEW_LEN) + "..."
      : msg.content}
  </text>
</Show>
```

`toolStatus` 从 `running` 变成 `completed` 是怎么触发的？靠 `onToolResult` 里的 `setMessages`。signal 一变，SolidJS 自动重渲染：`<Show when={msg.toolStatus === "running"}>` 从 true 变 false，spinner 消失，fallback 里的 `✓` 出现；同时结果预览 `<Show>` 从 false 变 true。

**整条消息没被替换，只是它的字段变了，UI 自动跟着变。** 这就是响应式编程的核心：你改数据，UI 自己更新，不用手动操作 DOM（终端元素）。

## spinner 是什么：Braille 字符的旋转动画

```ts
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
```

这是一组 Unicode Braille（盲文）点字字符，看起来像一个小圆圈在顺时针旋转：

```
⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏ ⠋ ⠙ ...  （循环）
```

`<spinner>` 元素每隔 `interval` 毫秒（我们设 80ms）切换到下一帧，看起来就是旋转动画。这是 CLI spinner 的经典做法--Python 的 `rich.spinner`、Node 的 `cli-spinner` 都用 Braille 帧。

### `<spinner>` 元素哪来的？

它不是 opentui 自带的，是 `opentui-spinner` 包提供的。用法：

```ts
import "opentui-spinner/solid"  // 副作用导入：注册 <spinner> 自定义元素
```

这一行 `import` 看起来没用--没导入任何变量。但它的**副作用**是往 opentui 注册了一个叫 `spinner` 的自定义元素，之后就能在 JSX 里写 `<spinner .../>` 了。

这种"副作用导入"在 JS 里很常见：导入某个模块只为触发它的注册逻辑，不用它导出的东西。对照 Python：

```python
import matplotlib.pyplot as plt  # 导入就注册了后端
import my_plugin                 # 这个文件里全是 @register(...) 装饰器，导入就注册了插件
```

`<spinner>` 接受两个关键 prop：`frames`（动画帧数组）和 `interval`（每帧间隔毫秒数）。它自己管动画循环，不需要你写 `setInterval`。这正是用现成包的好处--定时器、帧切换、清理都封装好了。

## 结果预览：为什么要截断

```ts
const RESULT_PREVIEW_LEN = 200
```

工具输出可能很长（`read` 读个大文件、`bash` 跑个测试），全显示会撑爆终端。截断到 200 字符 + "..."。

注意：这只是**显示层**的截断。`onToolResult(output)` 收到完整 output，存进 `msg.content` 的也是完整内容，只是渲染时切片。发给 LLM 的那一份（`agent-loop.ts` 里）走的是 `truncate()` 逻辑（`src/tool/truncate.ts`），和这里无关。

> **关注点分离**：截断发给 LLM 的内容（省 token）和截断显示给用户的内容（省屏幕）是两件事，各自独立。opencode 也是这样--显示层有 expand/collapse 折叠，发给 LLM 的有单独的 compaction 逻辑。

## 完整代码

看 `src/tui/agent.tsx` + `src/agent-loop.ts`。改动集中在：

- `agent-loop.ts`：`LoopCallbacks` 接口加 `id` 参数，`runAgentLoop` 透传 `tc.id`
- `agent.tsx`：`ChatMessage` 加工具状态字段，`onToolCall`/`onToolResult` 改成"新增 + 原地更新"，渲染加 spinner/✓ 切换

新增依赖：`opentui-spinner`

跑法：

```bash
bun run src/tui/agent.tsx
```

试一试：输入"读一下 src/index.ts"，能看到 spinner 转一下（文件小可能一闪而过），然后变成 ✓ + 文件内容预览。

## 对照 opencode

opencode 的工具调用展示在 `packages/tui/src/routes/session/index.tsx`（2600+ 行），核心是 `ToolPart` 组件。

### 状态机更完整

我们的工具状态只有 `running` | `completed`。opencode 有四个：

| 状态 | 含义 | 我们的对应 |
|------|------|-----------|
| `pending` | 刚收到调用，还没开始执行 | 无（直接 running） |
| `running` | 正在执行 | `running` |
| `completed` | 执行成功 | `completed` |
| `error` | 执行失败 | 无（失败也走 completed） |

opencode 把 `error` 单列出来，是为了失败时显示红色错误样式、支持展开看错误详情。我们简化成"成功失败都算 completed"，错误信息当结果文本显示。后续补全时可以加 `error` 状态。

### spinner 封装

opencode 把 spinner 封装成 `component/spinner.tsx`（才 24 行）：比我们多了主题颜色（`useTheme`）、动画开关（`useKV` 的 `animations_enabled`，关掉动画时显示静态 `⋯`）。我们直接内联用 `<spinner>`，没封装成组件--因为现在只有一个地方用。等别处也要 spinner 时再提取成共享组件，这是"三次法则"（Rule of Three）：重复三次才抽象。

### 按工具名分发不同展示

opencode 的 `ToolPart` 内部用 `<Switch>` 按工具名分发到 12 个不同子组件：`Read`、`Shell`、`Write`、`Edit`、`Grep`、`Glob`、`Task`... 每个工具有自己的展示样式。比如 `Shell` 用 BlockTool（多行带左边框），`Read` 用 InlineTool（单行紧凑）。我们现在所有工具用同一种展示，后续可以按工具类型分化。

下一步：[9.5 阶段验收 + 工程思维总结](./02-stage-review.md) -- 回顾整个 TUI 阶段。
