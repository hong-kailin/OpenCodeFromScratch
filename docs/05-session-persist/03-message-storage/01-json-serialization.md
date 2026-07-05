# 5.3 JSON 序列化：对象怎么存进数据库

> 本课目标：理解 SQLite 只能存基本类型（TEXT/INTEGER），学会用 JSON 序列化把复杂对象存进数据库。

## 核心问题

我们的 `Message` 类型有一个复杂字段：

```ts
interface Message {
  role: "system" | "user" | "assistant" | "tool"
  content: string | null
  tool_calls?: ToolCall[]   // ← 这是对象数组
  tool_call_id?: string
}
```

`tool_calls` 是一个 `ToolCall[]` 数组，每个 `ToolCall` 里有嵌套的 `function` 对象：

```ts
interface ToolCall {
  id: string
  type: "function"
  function: {
    name: string       // 嵌套对象
    arguments: string
  }
}
```

但 SQLite 的数据类型只有：`TEXT`（文本）、`INTEGER`（整数）、`REAL`（浮点数）、`BLOB`（二进制）。

**没有数组类型，没有对象类型。**

那 `tool_calls` 这种嵌套对象数组怎么存？

## JSON 序列化

方案：把对象转成 JSON 字符串，存到 TEXT 字段。

```
存：对象 → JSON.stringify → 字符串 → 存进 TEXT 字段
读：TEXT 字段 → 字符串 → JSON.parse → 对象
```

具体来看：

```
存的时候：
ToolCall[] 对象 → JSON.stringify → '[{"id":"call_1","type":"function","function":{"name":"read","arguments":"{}"}}]'
                                        ↑ 这是一整个字符串，存进 tool_calls TEXT 字段

读的时候：
tool_calls TEXT 字段 → '[{"id":"call_1",...}]' → JSON.parse → ToolCall[] 对象
```

> Python 类比：就像 `json.dumps()` 和 `json.loads()`。Python 的 sqlite3 也一样，不能直接存 list/dict，要 `json.dumps` 转成字符串。

## 代码里的转换

`src/message.ts` 里有两个转换函数：

```ts
// Message → DB 行（存的时候）
function messageToRow(sessionId: string, msg: Message) {
  return {
    // ...
    // tool_calls 是对象数组 → JSON.stringify 转成字符串
    tool_calls: msg.tool_calls ? JSON.stringify(msg.tool_calls) : null,
    //                ↑ 有才序列化，没有存 null
  }
}

// DB 行 → Message（读的时候）
function rowToMessage(row): Message {
  return {
    // ...
    // tool_calls 在 DB 里是 JSON 字符串 → JSON.parse 还原成数组
    tool_calls: row.tool_calls ? JSON.parse(row.tool_calls) as ToolCall[] : undefined,
    //                 ↑ 有才反序列化                     ↑ 类型断言
  }
}
```

关键点：
1. **存之前检查**：`msg.tool_calls ?` —— 不是所有消息都有 tool_calls（只有 assistant 调工具时有），没有的存 `null`
2. **读之后检查**：`row.tool_calls ?` —— 读出来如果是 `null`，就不 parse，设为 `undefined`
3. **类型断言**：`JSON.parse` 返回 `any`，用 `as ToolCall[]` 告诉 TypeScript 这是什么类型

> **JSON.parse 返回 any**：`JSON.parse` 不知道 JSON 字符串里是什么结构，所以返回 `any`。我们用 `as ToolCall[]` 断言类型。这不像 Python 的 pydantic 会自动验证——如果数据库里的 JSON 格式不对，运行时会出错。这是简化版的代价。

## 为什么不用多列？

你可能想：为什么不把 `tool_calls` 拆成多列？比如 `tool_call_id`、`tool_call_name`、`tool_call_args` 三列？

因为 **LLM 可以同时调多个工具**——一次返回 2 个、3 个 tool_calls。一个 assistant 消息对应多个 tool_call，是一对多关系。

拆成列只能存一个 tool_call。要存多个，要么：
1. **JSON 字符串**（我们的方案）：一个字段存任意多个，简单但没法在 SQL 里查单个 tool_call
2. **单独建表**（opencode 的方案）：每条 tool_call 一行，有独立生命周期，可以单独查询和更新

我们选了方案 1（简单），opencode 选了方案 2（灵活）。下一页讲为什么。

## 本课小结

1. **SQLite 只有基本类型**（TEXT/INTEGER/REAL/BLOB），没有数组/对象类型
2. **JSON 序列化**：存的时候 `JSON.stringify`（对象→字符串），读的时候 `JSON.parse`（字符串→对象）
3. **null 检查**：不是所有消息都有 tool_calls，没有的存 null，读出来不 parse
4. **JSON.parse 返回 any**：用 `as` 断言类型，但没有运行时验证

下一步：[5.3 Message 模块与 opencode 对比](./02-message-module.md) —— 完整实现，对照 opencode 的两表设计。
