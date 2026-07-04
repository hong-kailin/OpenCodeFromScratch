# 1.4 命令行交互：多轮对话

> 本课目标：把单次调用改成多轮对话——用户输入问题，AI 回复，能连续对话。理解 agent loop 的雏形。

## 从单次到多轮

上一课我们实现了"问一个问题，AI 回答一次"。但真正的 agent 要能连续对话——你问完一个问题，还能接着问下一个，AI 记得之前说过什么。

回顾 1.2 课的核心概念：**LLM 没有记忆，每次请求要带上全部历史消息**。所以多轮对话的关键就是维护一个 messages 数组，每次请求带上它，请求完把 AI 的回复追加进去。

## 单次 vs 多轮的流程对比

```
单次（上一课）：
  固定的 messages → 调 API → 打印回复 → 结束

多轮（本课）：
  ┌→ 读用户输入，加入 messages
  │     ↓
  │   调 API（带上全部 messages）
  │     ↓
  │   AI 回复加入 messages，打印回复
  └──── 循环
```

关键变化：messages 数组**在循环中不断增长**，每次都带上完整历史。

## Bun 的命令行输入

Python 读用户输入用 `input()`，TS 用什么？Bun 提供了一个简单的方式：

```ts
// Bun 内置的 prompt：弹出一行输入框，返回用户输入的字符串
const input = prompt("你: ")
// input 是用户输入的文本，用户取消则返回 null
```

> 类比 Python：`input("你: ")`，几乎一样。区别是 Bun 的 `prompt` 返回 `string | null`（用户取消时为 null），Python 的 `input` 总是返回 string。

### 为什么用 prompt 而不是 readline

Node.js 有 readline 模块（更底层的行读取），但 Bun 的 `prompt()` 更简单——一行代码就能读用户输入，不用配置。我们的多轮对话用 `prompt` 就够了。

> opencode 用的是 opentui（终端 UI 框架），比 readline 更复杂。我们阶段 9 才会接触 TUI，现在用最简单的方式。

## 循环：while(true)

要让对话持续，需要一个循环。TS 的 `while(true)` 和 Python 一样：

```ts
while (true) {
  const input = prompt("你: ")
  if (!input) break           // 用户取消或输入空，退出循环

  // 把用户输入加入 messages
  messages.push({ role: "user", content: input })

  // 调 API
  const reply = await chat(messages, config)

  // 把 AI 回复加入 messages（下次请求带上）
  messages.push({ role: "assistant", content: reply })

  // 打印回复
  console.log("AI:", reply)
}
```

### messages.push：往数组末尾添加元素

`push` 是数组的方法，往末尾加一个元素。类比 Python 的 `list.append()`：

```ts
// TS
const arr = [1, 2]
arr.push(3)  // [1, 2, 3]
```

```python
# Python
arr = [1, 2]
arr.append(3)  # [1, 2, 3]
```

### break：退出循环

用户输入空或取消时，`prompt` 返回 null 或空字符串。用 `break` 退出 `while(true)` 循环：

```ts
if (!input) break  // input 是 null 或 "" 时退出
```

> 类比 Python：`if not input: break`。

## 完整代码

修改 [`src/index.ts`](../../../src/index.ts)：

```ts
import type { Message } from "./types"
import { loadConfig, chat } from "./llm"

const config = await loadConfig()

// messages 历史：从 system prompt 开始，每轮追加 user 和 assistant 消息
const messages: Message[] = [
  { role: "system", content: "你是一个简洁的助手，用中文回答" },
]

console.log("AI 助手已启动，输入问题开始对话（Ctrl+C 退出）")

// 多轮对话循环
while (true) {
  const input = prompt("你: ")
  if (!input) break  // 用户取消或空输入，退出

  // 把用户输入加入历史
  messages.push({ role: "user", content: input })

  // 调 API（带上全部历史）
  const reply = await chat(messages, config)

  // 把 AI 回复加入历史（下次请求带上，AI 才能"记住"）
  messages.push({ role: "assistant", content: reply })

  console.log("AI:", reply)
}
```

## 跑起来

```bash
bun run src/index.ts
```

交互过程：

```
AI 助手已启动，输入问题开始对话（Ctrl+C 退出）
你: 1+1=?
AI: 2
你: 再加3
AI: 5
你: （按回车或取消退出）
```

注意第二次问"再加3"时，AI 能理解是 2+3=5，因为 messages 里带了之前的对话历史。

## 对照 opencode：agent loop 雏形

我们这个 `while(true)` 循环就是 agent loop 的雏形。看 opencode 的 `session/prompt.ts:1081`：

```ts
// opencode 的 runLoop（简化）
const runLoop = (sessionID) => Effect.fn("SessionPrompt.run")(function* (sessionID) {
  let step = 0
  while (true) {
    // 1. 获取消息历史
    let msgs = yield* MessageV2.filterCompactedEffect(sessionID)
    // 2. 调 LLM
    const result = yield* handle.process(...)
    // 3. 处理工具调用（我们阶段 3 才实现）
    // 4. 判断是否结束
    if (finished) break
    step++
  }
})
```

结构几乎一样：`while(true)` → 获取消息 → 调 LLM → 判断是否继续。区别是 opencode 还处理了工具调用、流式输出、持久化等。我们后续阶段会逐步补上。

## 教 Debug

### 对话没有上下文

如果你发现 AI 不记得之前说的话，检查：**是否把 AI 的回复加入了 messages**。忘了这行就没历史：

```ts
// ❌ 忘了这行，AI 不记得之前说过什么
// messages.push({ role: "assistant", content: reply })

// ✅ 每次都要把回复加入历史
messages.push({ role: "assistant", content: reply })
```

### prompt 返回 null

`prompt()` 在某些终端环境下可能不工作（返回 null）。如果遇到这个问题，确保用 `bun run` 而不是 `node` 运行——`prompt` 是 Bun 提供的。

### Ctrl+C 退不掉

`while(true)` 循环可以用 Ctrl+C 强制退出。如果不行，检查终端设置。

## 本课小结

1. **多轮对话核心**：维护 messages 数组，每次请求带上全部历史，请求完追加新消息
2. **prompt()**：Bun 内置的读用户输入函数，类比 Python `input()`
3. **while(true) + break**：循环对话，用户取消或空输入时退出
4. **messages.push()**：往数组末尾加元素，类比 Python `list.append()`
5. **agent loop 雏形**：我们的循环和 opencode 的 runLoop 结构一样，只是还没工具调用

下一步：[1.5 阶段验收](../05-stage-review/01-stage-review.md) —— 跑起来 + 工程思维总结。
