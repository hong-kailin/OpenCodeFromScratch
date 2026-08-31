# 13.2.3 agent-loop 参数校验：错误喂回，而不是中断

> 对照代码：`src/agent-loop-validation-demo.ts`（可运行的完整演示）、`src/agent-loop.ts`（实际落地）

上一课我们在 `01-validate.md` 里看到这段代码，看不懂很正常——它一口气用了
`.pipe()`、`mapError`、`flatMap`、`Effect.promise`、`Effect.try`、`Effect.catch`
六个 Effect 概念，还藏着一个设计思想。本课拆开讲。

## 1. 这段代码在 agent loop 里扮演什么角色？

先看上下文。agent loop 拿到 LLM 返回的 `tool_calls` 后，对每个工具调用做三件事：

```
LLM 返回 tool_calls
   │
   ▼
找到工具（找不到 → 错误文本）
   │
   ▼
解析 + 校验参数   ← 本课讲的就是这段（decodeAndRun + runTool）
   │
   ▼
执行工具 execute()
   │
   ▼
结果作为 tool 消息喂回给 LLM → 进入下一轮
```

## 2. 先看主流程 runTool：三层嵌套

`agent-loop.ts` 里的完整代码是这样（我先贴真实的，再拆）：

```typescript
const runTool = Effect.try({
  try: () => JSON.parse(tc.function.arguments),   // 第 1 层：字符串 → 对象
  catch: (e) => new ToolError({ message: `参数不是合法 JSON: ...` }),
}).pipe(
  Effect.flatMap(decodeAndRun),                    // 第 2 层：Schema 校验 + 执行工具
  Effect.catch((e) => Effect.succeed(...)),        // 第 3 层：兜底转字符串
)
output = yield* runTool
```

三层各管一件事：

| 层 | 代码 | 负责什么 | 类比 Promise |
|----|------|---------|-------------|
| 1 | `Effect.try({ try: JSON.parse, catch: ToolError })` | JSON 字符串 → 对象 | `Promise.resolve().then(() => JSON.parse(...))` 捕获同步异常 |
| 2 | `Effect.flatMap(decodeAndRun)` | 校验 + 执行 | `.then(args => execute(args))` |
| 3 | `Effect.catch(...)` | 兜底转字符串 | `.catch(e => e.message)` |

## 3. 逐层拆解

### 第 1 层：`Effect.try` —— 把"可能抛异常的代码"包成 Effect

```typescript
Effect.try({
  try: () => JSON.parse(tc.function.arguments),
  catch: (e) => new ToolError({ message: `参数不是合法 JSON: ...` }),
})
```

`JSON.parse` 遇到坏 JSON（比如 `"not json at all"`）会 `throw`。`Effect.try` 的作用：
**把"会 throw 的同步代码"包成一个 Effect**——throw 的异常会被捕获，转成 Effect 的失败。

类比 Python：

```python
# 之前：try/except 包裹
try:
    obj = json.loads(s)
except json.JSONDecodeError as e:
    raise ToolError(f"参数不是合法 JSON: {e}")

# Effect.try 就是这个 try/except 的封装，但结果是"值"而不是"异常"：
#   JSON.parse 成功 → Effect 成功，带 obj
#   JSON.parse 失败 → Effect 失败，带 ToolError
```

### 第 2 层：`Effect.flatMap(decodeAndRun)` —— 把校验+执行串起来

```typescript
const decodeAndRun = (rawArgs: unknown) =>
  Schema.decodeUnknownEffect(tool.parameters)(rawArgs).pipe(
    Effect.mapError(
      (e) => new ToolError({ message: `工具 ${tool.id} 参数校验失败: ${String(e)}` }),
    ),
    Effect.flatMap((args) => Effect.promise(() => tool.execute(args))),
  )
```

这里用了两个关键组合子，先分清它们：

**`Effect.mapError(f)`：只改"失败通道"，成功值原样过**

```
输入 Effect:  成功(args) 或 失败(SchemaError)
                        │
                 mapError(e => new ToolError(...))
                        │
输出 Effect:  成功(args) 或 失败(ToolError)   ← 只有失败被"翻译"了
```

作用：把 effect 内置的 `SchemaError` 翻译成我们自己定义的 `ToolError`
（带 tag、带 toolName）。**不改变成功路径**——校验通过后 args 原样往下走。

类比 Python：

```python
try:
    args = Schema.decode(...)        # 可能抛 SchemaError
except SchemaError as e:
    raise ToolError(f"参数校验失败: {e}")   # 翻译成 ToolError
```

**`Effect.flatMap(f)`：成功后才做下一步（f 返回新的 Effect）**

```
输入 Effect:  成功(args) 或 失败(ToolError)
                        │
                 flatMap(args => Effect.promise(() => execute(args)))
                        │
输出 Effect:  成功(执行结果) 或 失败(ToolError)
```

作用：**只有前面成功了**（校验通过，拿到类型安全的 args），才执行 `f`（执行工具）。
如果前面失败了，`flatMap` 直接跳过，失败继续往下传。

类比 Python（`flatMap` ≈ `then`，把两步异步串起来）：

```python
# flatMap 串起"校验 → 执行"两步
async def flow(raw):
    args = await Schema.decode(raw)   # 失败则抛，不会走到下一步
    return await execute(args)        # 成功才执行
```

**`Effect.promise(() => execute(args))`**：因为 `execute` 是普通 `async` 函数
（返回 Promise），要用 `Effect.promise` 把 Promise "桥接"进 Effect 世界。
这样 Promise 的 reject 也变成 Effect 的失败。类比 `asyncio` 和 Promise 之间的转换。

> 为什么用 `flatMap` 而不是 `map`？`map(f)` 要求 `f` 返回**普通值**；
> `flatMap(f)` 允许 `f` 返回**另一个 Effect**（甚至失败）。因为 `execute` 是异步的、
> 可能失败，必须用 `flatMap` 展开嵌套。这和你学过的 Python 里
> `async def` 里 `await` 一个 `async def` 函数同理——不能直接 return。

### 第 3 层：`Effect.catch` —— 兜底转字符串

```typescript
Effect.catch((e) => Effect.succeed(e instanceof Error ? e.message : String(e)))
```

这是"错误喂回"设计的最后一环。`Effect.catch` 捕获**任何**失败（ToolError、
execute 抛的错……），转成成功的字符串。类比 Promise 的 `.catch(e => e.message)`。

## 4. 关键设计：错误喂回，而不是中断

这是全段最重要的思想。**为什么不能直接 throw？**

```
如果直接 throw：
  参数一错 → 整个 Effect.gen 中断 → agent loop 崩掉 → 一次对话全废

喂回给 LLM：
  参数一错 → 错误文本作为 tool 消息返回
            → LLM 看到"Expected string, got 123"
            → 下一轮自己改对参数再调一次
```

opencode 源码里的原话（`opencode/packages/opencode/src/tool/tool.ts`）：

> This is the canonical "rewrite the input" tool error... its `message` getter
> produces the model-facing prose that the AI SDK feeds back as the tool result.

翻译：这是"重写输入"的工具错误——错误文本会被当作工具结果喂回给模型。

我们的 `runTool` 保证了这一点：

```typescript
// 无论成功失败，output 一定是一个字符串
let output: string
...
output = yield* runTool   // runTool 内部的 catch 兜底，绝不抛出去
```

跑 `src/agent-loop-validation-demo.ts` 能看到完整过程：

```
第 1 轮：LLM 调用 read({"filePath": 123})          ← 犯错了
   工具结果: 参数校验失败: SchemaError(Expected string, got 123)
   [喂回给 LLM]

第 2 轮：LLM 调用 read({"filePath": "src/read.ts"})  ← 看到错误后改对了
   工具结果: 成功读取了 src/read.ts
```

## 5. 一个容易踩的坑：mapError 的作用域

看代码里的注释（agent-loop.ts 第 98-100 行）：

> 注意：mapError 要包在 Schema 解码这一段，而不是整个链上。
> 如果包在整个链上，JSON.parse 阶段的 ToolError 也会被 mapError 再包装一次，
> 导致错误文本冗余（"校验失败: ToolError: 不是合法 JSON"）。

为什么？`mapError` 会"翻译"**它下游所有阶段的失败**。如果写成：

```typescript
// ❌ 错误示范：mapError 包在整个链上
Effect.try({ try: JSON.parse, catch: e => new ToolError("不是合法 JSON") })
  .pipe(
    Effect.flatMap(decode),
    Effect.mapError(e => new ToolError("校验失败: " + String(e))),  // 会连上面的 ToolError 一起翻译
    ...
  )
```

坏 JSON 时：第 1 层的 `ToolError("不是合法 JSON")` 会被第 3 层的 `mapError` 再包一次，
变成 `校验失败: ToolError: 不是合法 JSON`——信息重复。

正确写法是把 `mapError` 只放在 `decodeAndRun` 内部（只翻译 SchemaError），
JSON.parse 的 ToolError 留给最外层的 `catch` 处理。

## 6. 类比：整体就像一段 Python 的 try/except 链

把三层合起来，用 Python 写同样逻辑，长这样：

```python
def run_tool(arguments_json: str) -> str:
    try:
        # 第 1 层：JSON.parse
        raw = json.loads(arguments_json)              # 失败 → "不是合法 JSON"
        try:
            # 第 2 层：Schema 校验 + 执行
            args = Schema.decode(raw)                 # 失败 → "参数校验失败"
            return await execute(args)                # 失败 → execute 的错误
        except SchemaError as e:
            return f"参数校验失败: {e}"               # 不中断，转成字符串
    except json.JSONDecodeError as e:
        return f"不是合法 JSON: {e}"                  # 不中断，转成字符串
```

注意每个 `except` 分支都 `return` 字符串而不是 `raise`——**这就是"错误喂回"**：
函数永远返回一个可读的文本结果，调用方（agent loop）永远不会因为参数错误而崩溃。

## 一句话总结

> 用 `Effect.try` / `mapError` / `flatMap` / `catch` 把"解析 → 校验 → 执行"串成一条
> 永不抛异常的流水线：成功返回工具结果，失败返回错误文本，两者都作为 tool 消息
> 喂回给 LLM 自纠正——这就是 opencode 处理工具参数错误的全部逻辑。

## 跑一下

```bash
bun run src/agent-loop-validation-demo.ts
```

观察：第 1 轮失败 → 第 2 轮成功；坏 JSON 在哪一层报错。
