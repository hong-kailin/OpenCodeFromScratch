# 13.3 用 Schema 校验工具参数

> 对照代码：`src/schema-demo.ts` 第 3 节（演示）、`src/tool/*.ts` + `src/agent-loop.ts`（实际落地）

## 真实场景

每个工具的参数格式不同。LLM 返回的 `arguments` 是 JSON 字符串，需要解析 + 校验。

```typescript
// read 工具：只需要 filePath
export const Parameters = Schema.Struct({
  filePath: Schema.String.annotate({ description: "要读取的文件路径" }),
})

// write 工具：需要 filePath + content
export const Parameters = Schema.Struct({
  filePath: Schema.String.annotate({ description: "文件路径" }),
  content: Schema.String.annotate({ description: "要写入的完整内容" }),
})
```

## 工具参数校验

```typescript
// LLM 返回的参数（JSON 字符串 → 解析 → 校验）
const args = Schema.decodeUnknownEffect(Parameters)(JSON.parse(tc.function.arguments))
// args 类型安全：{ filePath: string }
// 如果参数不对，Effect 失败（SchemaError）
```

## 对比：Schema 校验 vs 裸 JSON.parse

```
裸 JSON.parse：
  const args = JSON.parse(str)  // any 类型，无校验
  如果 LLM 返回错误参数 → 静默失败或运行时崩溃

Schema 校验：
  Schema.decodeUnknownEffect(Schema)(JSON.parse(str))
  如果参数不对 → Effect 失败，带详细错误信息
  如果参数正确 → 类型安全的 args
```

## 在项目中的落地（阶段 13 新增）

**之前**：`src/agent-loop.ts` 用 try/catch 包裹裸 `JSON.parse`，无任何校验。

**现在**：

1. **工具定义**（`src/tool/*.ts`）：每个工具用 `Schema.Struct` 定义参数（单一来源），
   不再手写 JSON Schema。`execute` 的 `args` 类型由 Schema 推导，不再需要 `as` 断言：

   ```typescript
   // 之前：args: Record<string, unknown>，要 args.filePath as string
   // 现在：
   async function execute(args: Schema.Schema.Type<typeof Parameters>): Promise<string> {
     const { filePath } = args  // 类型安全，直接解构
   }
   ```

2. **JSON Schema 自动生成**（`src/tool/tool.ts`）：发给 LLM 的参数格式不再手写，
   用 `toJSONSchema()` 从同一个 Schema 自动生成——保证"LLM 看到的"和"运行期校验的"是同一份定义：

   ```typescript
   // 之前：手写 { type: "object", properties: {...}, required: [...] }
   // 现在：
   export function toJSONSchema(schema) {
     const document = Schema.toJsonSchemaDocument(schema, { additionalProperties: true })
     return normalize(document.schema)  // 清洗 optional 字段的 anyOf 噪音
   }
   ```

   > 这段跨度比较大？见 [02-json-schema-gen.md](./02-json-schema-gen.md)——
   > 为什么需要它、`Schema.toJsonSchemaDocument` 是什么、`normalize` 在洗什么，
   > 配套可运行 demo：`src/json-schema-demo.ts`。

3. **agent-loop 校验**（`src/agent-loop.ts`）：执行工具前用 `Schema.decodeUnknownEffect` 校验参数：

   ```typescript
   // 之前：const args = JSON.parse(tc.function.arguments)  // 无校验
   // 现在：
   const decodeAndRun = (rawArgs: unknown) =>
     Schema.decodeUnknownEffect(tool.parameters)(rawArgs).pipe(
       Effect.mapError((e) => new ToolError({ message: `工具 ${tool.id} 参数校验失败: ${String(e)}` })),
       Effect.flatMap((args) => Effect.promise(() => tool.execute(args))),
     )
   ```

   **关键设计**：校验失败的错误不中断 agent loop，而是作为工具结果文本喂回给 LLM
   （opencode 的设计是 `InvalidArgumentsError` 的错误文本返回给模型自纠正）。
   所以 agent-loop 里用 `Effect.catch` 兜底，把任何失败转成字符串。

   > 这段跨度比较大？见 [03-agent-loop-validation.md](./03-agent-loop-validation.md)——
   > 三层结构逐层拆解（`Effect.try` / `mapError` / `flatMap` / `catch`）、"错误喂回"
   > 设计、mapError 作用域的坑，配套可运行 demo：`src/agent-loop-validation-demo.ts`。

## 为什么单一来源

工具参数以前有**两份定义**：
- `parameters: JSONSchema`——手写的，给 LLM 看
- `execute(args: Record<string, unknown>)`——运行期用，靠 `as` 断言

两份定义容易不一致：改了手写 JSON Schema 忘了改 execute，或反过来。

现在**只有一份**（Effect Schema），三个用途自动派生：
- 类型（编译期）：`Schema.Schema.Type<typeof Parameters>`
- 校验器（运行期）：`Schema.decodeUnknownEffect(Parameters)`
- JSON Schema（给 LLM）：`toJSONSchema(Parameters)`

## 跑一下

```bash
bun run src/schema-demo.ts
```

看第 3 节：合法参数通过，非法参数被拦截并打印具体错误。

想看实际落地效果：让 agent 执行一个带错误参数的 read 调用（比如改 `src/agent-loop.ts`
里的测试用例），校验失败信息会作为工具结果返回。
