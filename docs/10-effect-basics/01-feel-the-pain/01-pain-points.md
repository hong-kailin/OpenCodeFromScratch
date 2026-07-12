# 10.1 感受痛点：依赖到处传（上）

> 本课不写任何 Effect，只让你看到现有代码里"依赖管理"的痛点。理解了痛，后面学 Effect 才知道它在治什么病。因内容较长，拆成两个文件，这是上篇（讲 7 个痛点），[下篇讲解法](./02-dependency-injection.md)。

## 为什么要先感受痛点

前 9 阶段我们写出了一个能跑的 agent。能跑，但代码里埋着几颗"定时炸弹"--随着功能增多会越来越痛。这颗炸弹叫**依赖管理**：config、provider、db、tools 这些东西，该怎么让需要它的代码拿到？

如果你现在感觉"还好啊，不就这么写嘛"，那是因为我们只有两个入口（CLI 和 TUI）。想象一下再加一个"HTTP API 入口"、一个"测试入口"……每个入口都要把 config/provider/tools 重新组装一遍。

下面把当前代码里的依赖管理问题一个个挖出来。

---

## 痛点 1：配置重复加载

`loadConfig()` 每次调用都重新读 `opencode.json` 文件。而它被调用了两次：

```ts
// src/index.ts:131（CLI 入口）
const config = await loadConfig()

// src/tui/agent.tsx:71（TUI 入口，在 handleSubmit 里）
const config = await loadConfig()
```

看看 `loadConfig` 干了什么（`src/llm.ts:11`）：

```ts
export async function loadConfig() {
  const config = await Bun.file("opencode.json").json()   // 每次都读文件
  // ...
}
```

**问题**：每次调用都读一次磁盘。TUI 里更糟--每发一条消息就调一次 `loadConfig()`，等于每发一句话就重读一遍配置文件。配置应该加载一次、全局共享。

---

## 痛点 2：Provider 重复构造

```ts
// src/index.ts:132
const provider = createOpenAIProvider(config)

// src/tui/agent.tsx:72（每条消息都构造一次！）
const provider = createOpenAIProvider(config)
```

provider 是个无状态对象，造一次就够了。但 TUI 里每发一条消息就重新造一次。应该"创建一次、到处复用"。

---

## 痛点 3：工具数组重复定义（最直观的痛）

```ts
// src/index.ts:133
const tools = [readTool, writeTool, editTool, bashTool, globTool, grepTool]

// src/tui/agent.tsx:73
const tools = [readTool, writeTool, editTool, bashTool, globTool, grepTool]
```

**一模一样的数组，写了两遍。** 假设要加第 7 个工具 `todowrite`，你得改两处。忘了第二处？CLI 能用，TUI 不能用，而且没有任何编译错误提醒你。

工具注册应该是一处定义、全局可用。

---

## 痛点 4：参数层层传递

`runToolLoop` 和 `runAgentLoop` 的参数列表越来越长：

```ts
// src/index.ts:30（CLI 版）
async function runToolLoop(
  messages: Message[],
  sessionId: string,
  provider: Provider,    // ← 传进来
  tools: Tool[],         // ← 传进来
)

// src/agent-loop.ts:24（TUI 版）
export async function runAgentLoop(
  messages: Message[],
  provider: Provider,    // ← 传进来
  tools: Tool[],         // ← 传进来
  callbacks: LoopCallbacks,
)
```

`provider` 和 `tools` 不是这些函数自己造的，是调用方造好传进来的。调用方自己也是从更上层拿的。依赖像接力棒一样一层层传。每加一个依赖，就要给函数加参数、再给所有调用处加实参。

---

## 痛点 5：db 是隐式全局单例

db 的处理方式和上面几个不同--它是个模块级全局变量：

```ts
// src/db.ts:50
export const db = drizzle(sqlite, { ... })

// src/session.ts:7 -- 直接 import 用
import { db, sessionTable } from "./db"
```

表面上看不用传 db 了，直接 import 就行。但问题：

1. **无法替换**：想在测试里用内存数据库？不行，db 写死在模块里，换不了。
2. **隐式依赖**：读 `session.ts` 的代码看不出它依赖 db--得点进 import 才知道。函数签名 `createSession()` 没参数，看起来像纯函数，其实偷偷用了全局 db。

痛点 1-4 是"传太多"（显式但啰嗦），痛点 5 是"藏起来"（简洁但换不了）。两个都不对。

---

## 痛点 6：无校验的 JSON.parse

```ts
// src/agent-loop.ts:58
const args = JSON.parse(tc.function.arguments)
```

`tc.function.arguments` 是 LLM 返回的字符串，可能是截断的、格式错的。`JSON.parse` 遇到这些直接崩。而且就算 parse 成功，`args` 的类型是 `any`--LLM 把 `filePath` 拼成 `filepath`，到运行时才报错。系统边界处没有校验。

---

## 痛点 7：字符串错误，无法精确捕获

```ts
// src/llm.ts:19
throw new Error(`配置文件里找不到 provider: ${providerID}`)
```

错误是字符串。想"只捕获配置错误、放过其他错误"？做不到--只能靠 `e.message.includes("找不到 provider")` 这种脆弱的字符串匹配。错误没有类型。

---

## 七个痛点的共性

| 痛点 | 表现 | 本质 |
|------|------|------|
| 1 配置重复加载 | 两处各自读文件 | 依赖没有全局共享 |
| 2 Provider 重复构造 | 每条消息重新造 | 依赖没有全局共享 |
| 3 工具数组重复 | 两份一样的清单 | 依赖没有全局共享 |
| 4 参数层层传 | 函数签名越来越长 | 依赖靠手动传递 |
| 5 db 隐式单例 | import 全局变量 | 依赖藏起来了，换不了 |
| 6 无校验 JSON.parse | 边界处不校验 | 依赖"约定"但无保证 |
| 7 字符串错误 | catch 靠字符串匹配 | 错误没类型 |

全是"依赖管理"问题。我们需要**第三条路**：依赖既显式（看得见谁需要什么）、又不用手动传（框架自动给）、还能替换（测试时换实现）。

这条路是什么？见下篇。

---

下一步：[依赖注入：第三条路](./02-dependency-injection.md)
