# 10.1 感受痛点：依赖到处传

> 本课目标：盘点当前代码里"依赖管理"的痛点，让你切身感受到为什么需要 Effect-TS 的 Service/Layer。**本课不写任何 Effect**，只让问题可见。理解了痛，下一课学 Effect 才知道它在治什么病。

## 为什么要先感受痛点

前 9 阶段我们用裸 async/await 写出了一个能跑的 agent。能跑，但代码里埋着几颗"定时炸弹"--随着功能增多会越来越痛。这颗炸弹的名字叫**依赖管理**：config、provider、db、tools 这些东西，该怎么让需要它的代码拿到？

如果你现在感觉"还好啊，不就这么写嘛"，那是因为我们只有两个入口（CLI 和 TUI）。想象一下再加一个"HTTP API 入口"、一个"定时任务入口"、一个"测试入口"……每个入口都要把 config/provider/tools 重新组装一遍。

这课我们就把当前代码里的依赖管理问题一个个挖出来。

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
export async function loadConfig(): Promise<{ baseURL: string; apiKey: string; modelID: string }> {
  const config = await Bun.file("opencode.json").json()   // 每次都读文件
  // ...
}
```

**问题**：
- 每次调用都读一次磁盘。TUI 里更糟--`handleSubmit` 每次发消息都调一次 `loadConfig()`，等于每发一句话就重读一遍配置文件。
- 配置没有"全局唯一实例"的概念。如果两处调用之间配置文件变了，它们拿到的是不同的 config。

**正确的样子**：配置应该加载一次，全局共享。谁需要就直接拿，不用各自读文件。

---

## 痛点 2：Provider 重复构造

```ts
// src/index.ts:132
const provider = createOpenAIProvider(config)

// src/tui/agent.tsx:72（在 handleSubmit 里，每条消息都构造一次！）
const provider = createOpenAIProvider(config)
```

`createOpenAIProvider` 把 config 包装成一个 Provider 对象（`src/provider/openai.ts`）。这个对象是无状态的，构造它不需要每次都做。但 TUI 里每发一条消息就重新构造一次。

**问题**：provider 是"创建一次、到处复用"的典型场景，现在却成了"用时即造、用完即弃"。

---

## 痛点 3：工具数组重复定义（最直观的痛）

```ts
// src/index.ts:133
const tools = [readTool, writeTool, editTool, bashTool, globTool, grepTool]

// src/tui/agent.tsx:73
const tools = [readTool, writeTool, editTool, bashTool, globTool, grepTool]
```

**一模一样的数组，写了两遍。**

### 实操感受：加第 7 个工具

假设我们要加一个 `todowrite` 工具（opencode 有这个）。你需要：

1. 写 `src/tool/todowrite.ts`（新工具）
2. 在 `src/index.ts:133` 改成 `[readTool, ..., grepTool, todowriteTool]`
3. 在 `src/tui/agent.tsx:73` **再改一遍**同样的东西

忘了第 3 步？那 CLI 能用 todowrite，TUI 不能用。两个入口行为不一致，而且没有任何编译期错误提醒你--因为 tools 数组是运行时构造的普通数组。

**问题**：工具注册应该是一处定义、全局可用。现在却要每个入口各自维护一份清单，靠人工保持同步。

---

## 痛点 4：参数层层传递

`runToolLoop` 和 `runAgentLoop` 的签名越来越长：

```ts
// src/index.ts:30（CLI 版）
async function runToolLoop(
  messages: Message[],
  sessionId: string,
  provider: Provider,    // ← 传进来
  tools: Tool[],         // ← 传进来
): Promise<void>

// src/agent-loop.ts:24（TUI 版）
export async function runAgentLoop(
  messages: Message[],
  provider: Provider,    // ← 传进来
  tools: Tool[],         // ← 传进来
  callbacks: LoopCallbacks,
): Promise<void>
```

`provider` 和 `tools` 不是 `runToolLoop` 自己造的，是调用方造好传进来的。调用方（index.ts:233）自己也是从更上层拿的：

```ts
// src/index.ts 的 handler 里
const config = await loadConfig()
const provider = createOpenAIProvider(config)
const tools = [readTool, ...]
// ...
await runToolLoop(messages, sessionId, provider, tools)   // 往下传
```

**问题**：依赖像接力棒一样一层层传。每加一个依赖（比如将来加个 `logger`、`permissionChecker`），就要给 `runToolLoop` 加一个参数，再给所有调用 `runToolLoop` 的地方加一个实参。参数列表越来越长，调用点越来越多。

这在软件工程里叫**依赖注射的抗药性**--你越用参数传递依赖，改动成本越高，最后就懒得加新依赖了，代码开始走样。

---

## 痛点 5：db 是隐式全局单例

db 的处理方式和上面几个不同--它是个**模块级单例**：

```ts
// src/db.ts:50
export const db = drizzle(sqlite, { schema: { sessionTable, messageTable } })
```

然后 `session.ts` 和 `message.ts` 直接 import 它：

```ts
// src/session.ts:7
import { db, sessionTable } from "./db"

// src/message.ts:7
import { db, messageTable } from "./db"
```

表面上看这"解决"了传递问题--不用传 db 了，直接 import。但这带来了新问题：

1. **无法替换实现**。想在测试里用内存数据库？不行，`db` 写死在模块里，测试时没法换成 mock。
2. **路径硬编码**。`DB_PATH = "opencode-from-scratch.db"`（`src/db.ts:40`）写死在模块顶层，没法从外部配置。
3. **隐式依赖**。读 `session.ts` 的代码看不出它依赖 db--得点进 import 才知道。函数签名 `createSession()` 没有参数，看起来像纯函数，其实偷偷用了全局 db。

**这是依赖管理的另一个极端**：痛点 1-4 是"传太多"（显式但啰嗦），痛点 5 是"藏起来"（简洁但隐式）。两个都不对。

---

## 痛点 6：无校验的 JSON.parse

```ts
// src/agent-loop.ts:58
const args = JSON.parse(tc.function.arguments)

// src/index.ts:80
const args = JSON.parse(tc.function.arguments)
```

`tc.function.arguments` 是 LLM 返回的字符串，理论上应该是合法 JSON。但 LLM 会犯错--可能返回截断的、多带个逗号的、甚至纯文本。`JSON.parse` 遇到这些就直接抛 `SyntaxError`，整个 agent loop 崩掉。

而且就算 parse 成功，`args` 的类型是 `any`--传给 `tool.execute(args)` 时没有任何校验。如果 LLM 把 `filePath` 拼成 `filepath`，工具拿到的是 `undefined`，到运行时才报错。

**问题**：在系统边界（接收外部输入的地方）没有校验。这其实是依赖管理的延伸--工具依赖"参数符合约定"，但这个约定既没有类型保证，也没有运行时校验。

---

## 痛点 7：字符串错误，无法精确捕获

```ts
// src/llm.ts:19
throw new Error(`配置文件里找不到 provider: ${providerID}`)

// src/agent-loop.ts:56
output = `错误：找不到工具 ${tc.function.name}`
```

错误是字符串。调用方想"只捕获配置错误、放过其他错误"？做不到--`catch (e)` 抓到的是 `Error`，只能靠 `e.message.includes("找不到 provider")` 这种脆弱的字符串匹配。

**问题**：错误没有类型。这也是依赖问题--调用方依赖"能区分不同错误"的能力，但错误是无类型的字符串，没法精确依赖。

---

## 七个痛点的共性

把上面七个问题放一起看：

| 痛点 | 表现 | 本质 |
|------|------|------|
| 1 配置重复加载 | 两处各自读文件 | 依赖没有全局共享 |
| 2 Provider 重复构造 | 每条消息重新造 | 依赖没有全局共享 |
| 3 工具数组重复 | 两份一样的清单 | 依赖没有全局共享 |
| 4 参数层层传 | 函数签名越来越长 | 依赖靠手动传递 |
| 5 db 隐式单例 | import 全局变量 | 依赖藏起来了，无法替换 |
| 6 无校验 JSON.parse | 边界处不校验 | 依赖"约定"但无保证 |
| 7 字符串错误 | catch 靠字符串匹配 | 依赖错误类型但无类型 |

**共性**：全是"依赖管理"问题。代码需要各种各样的依赖（config、provider、tools、db、校验器、错误类型），但当前没有一个统一、显式、可替换的方式来管理它们。

我们现在的状态是"两头不靠"：
- 显式传递（痛点 1-4）：能替换，但啰嗦、易漏、重复
- 隐式全局（痛点 5）：简洁，但藏依赖、不可替换

我们需要的是**第三条路**：依赖既显式（看得见谁需要什么）、又不用手动传（框架自动提供）、还能替换（测试时换实现）。

---

## 这第三条路叫什么：依赖注入

先别管"依赖注入"这个吓人的名词。用大白话讲，它就是"工具间"模式。

### 举个生活中的例子：工地的工具

想象一个建筑工地，工人干活需要各种工具（锤子、锯子、梯子）。工具有三种管理办法：

**办法一：每个人自己带工具上班**（对应我们的痛点 1-4）

每个工人上班自己扛着锤子、锯子、梯子来。

- 想换把新锤子？得通知每个工人都换一把。
- 工地新进了一种电动锯子？得挨个告诉每个工人"记得带上电动锯子"。
- 痛点就是我们的代码现状：`index.ts` 和 `agent.tsx` 各自带着一份 tools 数组，加个工具要改两处。

**办法二：角落放个公共工具箱，谁要谁偷偷去拿**（对应我们的痛点 5）

工地角落放个工具箱，不登记、不分配，谁需要谁自己去翻。

- 看起来方便--不用每个人自己带了。
- 但问题来了：新来的工人不知道工具箱在哪（隐式依赖，得点进 `import` 才发现）；想测试新锤子时，不知道谁在用旧锤子，没法单独替换（不可替换）；工具箱被人换了锁，所有人突然拿不到工具。
- 这就是我们的 `db`：藏在模块里 import，测试时换不了，路径写死。

**办法三：设一个工具管理处**（这就是依赖注入）

工地设个工具管理处。工人上岗前登记"我需要锤子和锯子"，管理处把工具直接发到工位上。

- 工人不用自己带（不用手动传参）。
- 工人不用偷偷去角落找（不是隐式全局）。
- 工具清单在管理处统一维护，加新工具登记一次就行（一处定义，全局可用）。
- 想给某个工人测试新锤子？管理处发个假锤子给他，不影响别人（可替换，测试时 mock）。

**办法三就是依赖注入**：有个统一的地方（"容器"）存放所有共享资源，谁需要就声明一声，容器自动把东西送过去。

### 套到我们的代码上

我们想要的：

- `config`、`provider`、`tools`、`db` 这些共享资源，在程序启动时造好，放进"容器"
- `runAgentLoop` 需要 provider 和 tools？它声明"我需要这俩"，容器自动给
- 想给 `runAgentLoop` 换个 mock provider 做测试？容器发个假的就行，不用改 `runAgentLoop` 的代码
- 加第 7 个工具？在容器里登记一次，所有需要 tools 的地方自动能用

**Effect-TS 的 Service + Layer 就是这个"容器"**：
- **Service** = 工人登记的"我需要什么"（声明依赖）
- **Layer** = 管理处的"工具怎么造出来"（提供实现）
- 程序启动时把 Layer 组装好，运行时函数通过 Service 自取，不用层层传参

这是 opencode 解决上面七个痛点的方案，也是阶段 10 剩下几课的主题。

---

## 本课小结

1. **七个痛点全是依赖管理问题**：要么重复（1-3）、要么啰嗦（4）、要么隐式（5）、要么无保证（6-7）
2. **显式传参与隐式全局都不对**：前者像"每个人自己带工具"，后者像"偷偷用公共工具箱"，都需要一个更好的办法
3. **依赖注入就是"工具管理处"**：统一存放共享资源，声明即取用，可替换。Effect-TS 的 Service/Layer 是它的 TS 实现

本课没有写任何代码--痛点都在现有代码里，你打开 `src/index.ts` 和 `src/tui/agent.tsx` 对照着看就能发现。下一课开始学 Effect 基础，为 10.3 的 Service/Layer 铺路。

---

下一步：[10.2 Effect 基础：一个延迟的计算描述](../02-effect-basics/01-effect-basics.md) -- Effect 是什么、Effect.gen/yield*/runPromise，跑通第一个 Effect 程序。
