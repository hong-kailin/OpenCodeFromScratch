# 回调函数详解

> 本课目标：彻底搞懂回调函数是什么、为什么需要它、agent.tsx 里一层套一层的回调到底怎么执行。

## 你遇到的困惑

看 `agent.tsx` 第 64-94 行，大概是这样的结构：

```ts
await runAgentLoop(internalMessages, provider, tools, {
  onChunk(chunk) {
    setMessages((prev) => {
      // ...
      return newArray
    })
  },
  onToolCall(name, args) {
    setMessages((prev) => {
      // ...
    })
  },
})
```

第一眼看上去：`runAgentLoop` 里套了 `onChunk`，`onChunk` 里又套了 `setMessages`，`setMessages` 里还有个 `(prev) =>`。一层套一层，谁调谁、什么时候执行，完全看不清。

这节课把这团代码一层一层拆开，让你看到每一层在干什么、为什么是回调。

## 第一步：回调函数到底是什么

**回调函数就是"你把一个函数交给别人，让别人在合适的时机替你调用它"。**

这个名字本身就说明了意思：call + back = 调用 + 回来。"你先调用我的函数，我回头再调你给我的函数"。

你其实早就在 Python 里用过回调了，只是没这么叫：

```python
# Python：sorted 不知道怎么比较元素，你传一个 key 函数给它
# sorted 会在比较时"回调"这个函数
sorted([3, 1, 2], key=lambda x: x)

# Python：map 不知道怎么变换元素，你传一个函数给它
# map 会在处理每个元素时"回调"这个函数
list(map(str.upper, ["hello", "world"]))

# Python：pandas apply
df["price"].apply(lambda x: x * 1.1)

# Python：asyncio 的 done callback
task.add_done_callback(lambda t: print("完成了！"))
```

这些例子里，`lambda x: x`、`str.upper`、`lambda x: x * 1.1` 都是回调函数。你把函数当作参数传给 `sorted`/`map`/`apply`，它们在内部调用你的函数。

JavaScript 里的回调完全是一回事，只是语法不同。

## 第二步：为什么需要回调

### 场景：等快递

你网购了一个东西，不知道什么时候送到。有两个方案：

```
方案 1（轮询）：每 5 分钟去门口看一眼快递来了没
  -> 浪费精力，大部分时候白跑

方案 2（回调）：留个手机号给快递员，送到时打电话通知你
  -> 你该干嘛干嘛，快递员到了才打扰你
```

回调就是方案 2。你不知道事情什么时候发生，所以留一个"联系方式"（函数），让对方在事情发生时通知你。

### 对应到 agent.tsx

agent loop 调 LLM 时，LLM 的回答是**流式返回**的--一个字一个字蹦出来，不知道什么时候蹦完。agent loop 不知道该怎么显示这些字（CLI 版要写终端，TUI 版要更新 signal）。

解决方案：TUI 传一个 `onChunk` 函数给 agent loop，说"每收到一个字，就调这个函数通知我"。

```
agent loop：我在等 LLM 回答，回答是一个字一个字来的
TUI：我不知道什么时候来，但我准备好了 onChunk 函数
agent loop：好，每来一个字我就调 onChunk("你")、onChunk("好")...
TUI 的 onChunk 被调用 -> 更新 signal -> 屏幕上显示出来
```

## 第三步：JavaScript 回调的三种写法

Python 里传回调很简单--定义函数，传函数名：

```python
# Python
def on_chunk(text):
    print(text)

run_loop(on_chunk)   # 传函数引用
```

JavaScript 有三种写法，**做的事情完全一样**，只是语法不同：

### 写法 1：先定义函数，再传引用（和 Python 一样）

```ts
function onChunk(text: string) {
  console.log(text)
}

runAgentLoop(messages, provider, tools, onChunk)   // 传函数引用
```

### 写法 2：匿名函数，直接内联

```ts
runAgentLoop(messages, provider, tools, function (text: string) {
  console.log(text)
})
```

不单独定义函数了，直接在传参的地方写 `function(text) { ... }`。这个函数没有名字，所以叫"匿名函数"。

### 写法 3：箭头函数，更短的匿名函数

```ts
runAgentLoop(messages, provider, tools, (text: string) => {
  console.log(text)
})
```

`(text) => { ... }` 就是 `function(text) { ... }` 的简写。叫"箭头函数"因为有个 `=>`。

类比 Python：箭头函数就像 Python 的 `lambda`，但 `lambda` 只能写一行，箭头函数可以写多行。

### 三种写法等价

```ts
// 写法 1：具名函数
function onChunk(text) { console.log(text) }
runLoop(onChunk)

// 写法 2：匿名函数
runLoop(function (text) { console.log(text) })

// 写法 3：箭头函数
runLoop((text) => { console.log(text) })

// 以上三种完全等价！
```

**为什么 JavaScript 喜欢用箭头函数？** 因为回调经常是"只用一次"的函数，没必要单独定义。箭头函数写法短，能直接内联在传参的地方，代码更紧凑。

## 第四步：箭头函数的语法细节

`agent.tsx` 里大量使用箭头函数，有必要把语法讲清楚。

### 基本形式

```ts
// 箭头函数
(text) => { console.log(text) }

// 等价的普通函数
function (text) { console.log(text) }
```

`=>` 左边是参数，右边是函数体。就这么简单。

### 省略规则

```ts
// 规则 1：只有一个参数时，括号可以省略
(text) => { ... }    // 标准
text => { ... }      // 省略括号（只有一个参数时）

// 规则 2：没有参数时，必须写空括号
() => { ... }

// 规则 3：函数体只有一行 return 时，可以省略花括号和 return
(text) => text.toUpperCase()
// 等价于
(text) => { return text.toUpperCase() }
```

### 在 agent.tsx 里的例子

```ts
// 例子 1：setMessages 的回调，有花括号、有 return
setMessages((prev) => {
  const last = prev[prev.length - 1]!
  if (last.role !== "assistant") {
    return [...prev, { role: "assistant", content: chunk }]
  }
  return [...prev.slice(0, -1), { ...last, content: last.content + chunk }]
})

// 例子 2：useKeyboard 的回调，有花括号、没有 return（不需要返回值）
useKeyboard((evt) => {
  if (evt.name === "return" && !loading()) {
    evt.preventDefault()
    handleSubmit()
  }
})

// 例子 3：ref 的回调，有花括号、没有 return
ref={(val: TextareaRenderable) => {
  textarea = val
  queueMicrotask(() => val.focus())
}}
```

看到 `(xxx) => { ... }` 就在心里念：这是一个函数，参数是 xxx，函数体是花括号里的内容。

## 第五步：对象方法简写（回顾）

上一节（01-input-agent.md）讲过，`onChunk(chunk) { ... }` 是对象方法的简写。这里快速回顾，因为它和箭头函数长得不一样但本质相同：

```ts
// 这整个是一个对象，作为 runAgentLoop 的第 4 个参数
{
  onChunk(chunk) {
    // ...函数体...
  },
  onToolCall(name, args) {
    // ...函数体...
  },
  onToolResult(output) {
    // ...函数体...
  },
}
```

`onChunk(chunk) { ... }` 等价于 `onChunk: function(chunk) { ... }`，也等价于 `onChunk: (chunk) => { ... }`。三种写法定义的都是函数，只是写法不同。

> 别被语法吓到。不管看到 `onChunk(chunk) { ... }` 还是 `(chunk) => { ... }` 还是 `function(chunk) { ... }`，它们都是函数。区别只是"定义在什么位置、用了哪种简写"。

## 第六步：agent.tsx 逐层拆解

现在把 `agent.tsx` 第 64-94 行的回调结构一层一层拆开。

### 全景图

先看整体结构，有三个层次：

```
await runAgentLoop(..., {
                           ┌──────────────────────────────────────┐
  第 1 层                  │  回调对象：{ onChunk, onToolCall, ... }│
  传给 runAgentLoop ──────>│  runAgentLoop 在不同时机调用这些方法    │
                           └──────────────┬───────────────────────┘
                                          │
                                          │ runAgentLoop 调用 onChunk("你")
                                          ▼
  第 2 层                  ┌──────────────────────────────────────┐
  onChunk 内部             │  setMessages((prev) => { ... })       │
  传给 setMessages ───────>│  SolidJS 用当前值调用这个函数          │
                           └──────────────┬───────────────────────┘
                                          │
                                          │ SolidJS 调用 (prev) => ...
                                          ▼
  第 3 层                  ┌──────────────────────────────────────┐
  箭头函数内部             │  判断最后一条消息的 role               │
  真正的逻辑               │  返回新的 messages 数组               │
                           └──────────────────────────────────────┘
```

下面逐层拆开。

### 第 1 层：回调对象传给 runAgentLoop

```ts
await runAgentLoop(internalMessages, provider, tools, {
  // 这是一个对象，有三个方法
  // runAgentLoop 会拿着这个对象，在合适的时机调用里面的方法
  onChunk(chunk) { ... },
  onToolCall(name, args) { ... },
  onToolResult(output) { ... },
})
```

**谁定义的**：TUI（agent.tsx）。

**谁调用的**：`runAgentLoop`（agent-loop.ts）。看 agent-loop.ts 第 33 行：

```ts
// agent-loop.ts 第 33 行
const result = await provider.chatWithTools(messages, tools, callbacks.onChunk)
//                                                                   ^^^^^^^^^^^^^^
// 把 onChunk 函数传给 provider，provider 在收到 LLM 文本时调用它
```

以及第 48、57 行：

```ts
// agent-loop.ts 第 48 行
callbacks.onToolCall(tc.function.name, tc.function.arguments)
// 调工具时通知 TUI

// agent-loop.ts 第 57 行
callbacks.onToolResult(output)
// 工具结果出来时通知 TUI
```

**为什么用回调**：`runAgentLoop` 只管"什么时候有文本、什么时候调工具"，不管"怎么显示"。TUI 决定怎么显示。回调就是把"怎么显示"这个决策从 loop 里拿出来，交给调用方。

Python 类比：

```python
# Python 等价写法
class TuiCallbacks:
    def on_chunk(self, chunk):
        # 更新 TUI signal
        ...
    def on_tool_call(self, name, args):
        ...
    def on_tool_result(self, output):
        ...

# agent loop 内部
def run_agent_loop(messages, provider, tools, callbacks):
    result = provider.chat_with_tools(messages, tools, callbacks.on_chunk)
    callbacks.on_tool_call(name, args)
    callbacks.on_tool_result(output)
```

### 第 2 层：onChunk 内部调用 setMessages

```ts
onChunk(chunk) {
  setMessages((prev) => {
    // ...
  })
}
```

`onChunk` 被 `runAgentLoop` 调用时，拿到 LLM 返回的文本片段 `chunk`。它要做的第一件事是更新 TUI 的消息列表--调用 `setMessages`。

但 `setMessages` 不是直接设值，而是传了一个**函数** `(prev) => { ... }` 给它。这是 SolidJS 的"函数式更新"模式。

**为什么不直接 `setMessages(newArray)` 而要传函数？**

因为你需要**当前的消息列表**才能算出新列表。比如：

- "最后一条是 assistant 吗？" -> 需要看当前列表
- "如果是，追加 chunk" -> 需要当前列表最后一条的内容
- "如果不是，新建一条" -> 需要当前列表来拼接

但你不知道当前列表是什么--`onChunk` 被调用时拿不到 `messages()`（SolidJS 的 signal 读取）。传一个函数给 `setMessages`，SolidJS 会用当前值调用这个函数：

```
你：setMessages((prev) => { ... })
            ↑ 你传了一个函数

SolidJS：好，当前 messages 是 [msg1, msg2, ...]，我把它传给你的函数

你的函数：收到 prev=[msg1, msg2, ...]，基于 prev 计算新数组，return newArray

SolidJS：收到 newArray，更新 signal，触发重渲染
```

Python 类比：

```python
# Python 等价：函数式更新
def set_messages(update_fn):
    """SolidJS 的 setMessages 的简化版"""
    current = get_current_messages()    # SolidJS 内部获取当前值
    new = update_fn(current)            # 调用你传的函数
    store(new)                          # 存新值，触发重渲染

# 使用
set_messages(lambda prev: prev + [new_message])
```

`setMessages((prev) => ...)` 里的 `(prev) => ...` 就是 `lambda prev: ...`，只是 JS 的箭头函数能写多行。

### 第 3 层：箭头函数内部，真正的逻辑

```ts
(prev) => {
  const last = prev[prev.length - 1]!
  if (last.role !== "assistant") {
    return [...prev, { role: "assistant", content: chunk }]
  }
  return [
    ...prev.slice(0, -1),
    { ...last, content: last.content + chunk },
  ]
}
```

这是最里面一层，也是唯一有实际逻辑的地方。SolidJS 调用这个函数，传入当前消息列表 `prev`，函数返回新的消息列表。

逻辑拆解：

```ts
// 1. 拿到最后一条消息
const last = prev[prev.length - 1]!
//    prev[prev.length - 1]   -> 取数组最后一个元素
//    !                       -> TypeScript 的"非空断言"：告诉编译器"我保证这不是 undefined"

// 2. 判断最后一条是不是 assistant
if (last.role !== "assistant") {
  // 不是 assistant（比如是 user 或 tool）-> 新建一条 assistant 消息
  return [...prev, { role: "assistant", content: chunk }]
  //     [...prev, 新消息]  -> 展开旧数组，末尾追加新消息
}

// 3. 最后一条是 assistant -> 追加 chunk 到它的 content
return [
  ...prev.slice(0, -1),                        // 除了最后一条之外的所有旧消息
  { ...last, content: last.content + chunk },   // 最后一条，content 追加 chunk
]
```

`...prev` 是 JavaScript 的展开语法（spread），类比 Python 的 `*` 解包：

```python
# Python 等价
new_list = [*prev, new_item]         # 等价于 JS 的 [...prev, new_item]
```

`{ ...last, content: last.content + chunk }` 是对象展开，类比 Python 的字典合并：

```python
# Python 等价
new_dict = {**last, "content": last["content"] + chunk}
# 用 last 的所有字段，但把 content 覆盖成新值
```

## 第七步：两种回调模式

到这里你可能发现，`agent.tsx` 里出现了两种不同用途的回调。把它们区分清楚，就不会混淆：

### 模式 1：事件回调 -- "事情发生了，这是数据"

`onChunk`、`onToolCall`、`onToolResult` 属于这种。

```
agent loop：LLM 返回了一个字 "你"（事件发生）
            -> 调用 onChunk("你")（把数据传给你）
TUI：收到 "你"，更新界面
```

特点：**对方主动通知你，你被动响应。** 你不知道什么时候被调用，但被调用时一定能拿到数据。

Python 类比：

```python
# asyncio 的 done_callback 就是事件回调
task.add_done_callback(lambda t: print("任务完成了"))
# asyncio 会在任务完成时调用你的函数，你不知道什么时候
```

### 模式 2：转换回调 -- "这是当前值，给我新值"

`setMessages((prev) => ...)` 属于这种。

```
你：setMessages((prev) => { ... return newArray })
         ↑ 你主动调用 setMessages，但传了一个函数给它

SolidJS：好的，当前值是 [msg1, msg2]，我把它传给你的函数
你的函数：基于 prev 计算并 return 新数组
SolidJS：用新数组更新 signal
```

特点：**你主动发起，但需要对方提供当前值才能计算。** 函数必须返回新值。

Python 类比：

```python
# 银行账户的"根据当前余额计算新余额"就是转换回调
account.update(lambda balance: balance - 100)
# update 内部：current = get_balance() -> new = lambda(current) -> save(new)
# 你不知道当前余额是多少，但你传一个函数让 update 帮你算
```

### 放在一起看

```ts
onChunk(chunk) {                          // ← 模式 1：事件回调
                                           //   agent loop 调用它，传入 chunk
  setMessages((prev) => {                 // ← 模式 2：转换回调
                                           //   你调用 setMessages，传入函数
    // prev 是 SolidJS 给你的当前值
    // 你 return 新值
    return newArray
  })
}
```

**模式 1 是别人调你，模式 2 是你调别人但传了个函数进去。** 两层回调嵌套，其实是一个"被调用"和一个"主动调用"组合在一起。

## 第八步：完整执行流程追踪

光拆结构还不够，下面追踪一个真实的执行过程，看每一层回调在什么时候触发。

### 场景：用户输入"你好"，LLM 流式返回"你好！我是 AI"

初始状态：`messages = [{ role: "assistant", content: "你好！我是 AI 助手..." }]`

### 阶段 1：用户按 Enter

```
用户在终端输入"你好"，按 Enter
  -> useKeyboard 回调被触发（这也是一个事件回调！）
  -> 调用 handleSubmit()
  -> handleSubmit 读 textarea 内容，调 runAgentLoop
```

### 阶段 2：runAgentLoop 启动

```
runAgentLoop 调用 provider.chatWithTools(messages, tools, callbacks.onChunk)
  -> provider 发 HTTP 请求给 LLM
  -> LLM 开始流式返回
```

### 阶段 3：LLM 返回第一个字"你"

这是核心部分，完整追踪回调链：

```
① provider/openai.ts 第 73 行：
   LLM 的流式响应里解析出 content="你"
   调用 onChunk("你")
       │
       │  这个 onChunk 是谁？就是 agent.tsx 里定义的那个方法
       ▼
② agent.tsx 第 67 行，onChunk(chunk) 被调用，chunk="你"
   执行 setMessages((prev) => { ... })
       │
       │  传了一个箭头函数给 setMessages
       ▼
③ SolidJS 内部：
   拿到当前 messages = [{ role: "assistant", content: "你好！我是 AI 助手..." }]
   把它作为 prev 传给箭头函数
       │
       ▼
④ agent.tsx 第 69 行，箭头函数执行：
   const last = prev[prev.length - 1]!
   // last = { role: "assistant", content: "你好！我是 AI 助手..." }

   last.role !== "assistant" ？
   // "assistant" !== "assistant" -> false
   // 所以走第二个 return

   return [
     ...prev.slice(0, -1),                    // 空数组（prev 只有一个元素，slice 掉后没了）
     { ...last, content: last.content + "你" } // content 变成 "你好！我是 AI 助手...你"
   ]
       │
       │  返回了新的 messages 数组
       ▼
⑤ SolidJS 收到新数组：
   更新 signal -> 触发重渲染
   屏幕上最后一条消息变成 "你好！我是 AI 助手...你"
```

### 阶段 4：LLM 返回第二个字"好"

```
① provider/openai.ts 第 73 行：onChunk("好")

② agent.tsx onChunk 被调用，chunk="好"
   setMessages((prev) => { ... })

③ SolidJS 拿当前值（现在是 "你好！我是 AI 助手...你"）传给箭头函数

④ 箭头函数：
   last = { role: "assistant", content: "你好！我是 AI 助手...你" }
   last.role 是 "assistant" -> 追加
   return [...prev.slice(0,-1), { ...last, content: "你好！我是 AI 助手...你好" }]

⑤ SolidJS 更新 -> 屏幕显示 "你好！我是 AI 助手...你好"
```

后续的"！"、"我"、"是"、"A"、"I" 每个字都重复这个过程。每来一个 chunk，就走一遍 ① 到 ⑤。

### 阶段 5：LLM 返回完毕，决定调用工具

```
provider 返回 toolCalls=[{ name: "read", arguments: '{"filePath":"src/index.ts"}' }]
runAgentLoop 第 48 行：callbacks.onToolCall("read", '{"filePath":"src/index.ts"}')

-> agent.tsx onToolCall 被调用
-> setMessages((prev) => [...prev, { role: "tool", content: '调用 read(...)' }])
-> 屏幕新增一条 "🔧 调用 read(...)"
```

注意这里 `onToolCall` 里也用了 `setMessages((prev) => ...)`，和 `onChunk` 里的模式一样--都是转换回调。但这个更简单：只是在末尾追加一条消息，不需要判断。

## 第九步：agent.tsx 里所有回调的汇总

把 `agent.tsx` 里出现的所有回调列出来，你会发现它们的套路都一样：

| 回调 | 在哪 | 类型 | 谁调它 | 做什么 |
|------|------|------|--------|--------|
| `onChunk(chunk)` | 第 67 行 | 事件回调 | runAgentLoop | LLM 来文本时更新消息 |
| `onToolCall(name, args)` | 第 80 行 | 事件回调 | runAgentLoop | 调工具时显示工具名 |
| `onToolResult(output)` | 第 87 行 | 事件回调 | runAgentLoop | 工具结果出来时显示 |
| `(prev) => newArray` | onChunk 内部 | 转换回调 | SolidJS | 基于当前消息列表算新列表 |
| `(prev) => newArray` | onToolCall 内部 | 转换回调 | SolidJS | 同上 |
| `(prev) => newArray` | onToolResult 内部 | 转换回调 | SolidJS | 同上 |
| `(evt) => { ... }` | 第 109 行 | 事件回调 | opentui | 按键时触发提交 |
| `(val) => { ... }` | 第 145 行 | 事件回调 | opentui | textarea 创建时存引用 |

全部就两种模式：事件回调（别人通知你）和转换回调（你需要当前值算新值）。没有第三种。

## 本课小结

1. **回调 = 把函数当参数传给别人，让别人在合适的时机调用它**。Python 的 `sorted(key=...)`、`map(func, ...)` 都是回调
2. **JS 三种写法等价**：具名函数 `function f() {}`、匿名函数 `function() {}`、箭头函数 `() => {}`，只是语法不同
3. **箭头函数** `(x) => { ... }` 就是 Python 的多行 `lambda`，`agent.tsx` 里到处都是
4. **两种回调模式**：事件回调（别人通知你，如 `onChunk`）、转换回调（你需要当前值算新值，如 `setMessages((prev) => ...)`）
5. **嵌套不可怕**：`onChunk` 里套 `setMessages` 里套箭头函数，其实就是"被 agent loop 调用 -> 主动调 setMessages -> setMessages 回调你的函数"。每一层只有一个职责
