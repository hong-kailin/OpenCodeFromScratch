# 13.3.2 `toJSONSchema`：一份定义，三种用途自动派生

> 对照代码：`src/tool/tool.ts`（`toJSONSchema` 的实际实现）
> 教学 demo `src/json-schema-demo.ts` 已清理，可通过 git 历史查看

上一课我们在 `01-validate.md` 里看到这段代码，跨度很大看不懂：

```typescript
export function toJSONSchema(schema) {
  const document = Schema.toJsonSchemaDocument(schema, { additionalProperties: true })
  return normalize(document.schema)  // 清洗 optional 字段的 anyOf 噪音
}
```

本课把"为什么要它""它凭什么能自动生成""normalize 在洗什么"拆开讲。

## 1. 先搞清两样东西分别是什么

**JSON Schema**：一种用 JSON 描述"另一个 JSON 长什么样"的标准。LLM 靠它知道
"read 工具要传什么参数"。阶段 13 之前我们是手写的：

```jsonc
// 之前手写的（给 LLM 看的）
{
  "type": "object",
  "properties": { "filePath": { "type": "string", "description": "要读取的文件路径" } },
  "required": ["filePath"]
}
```

**Effect Schema**：我们工具里的 `Parameters = Schema.Struct({ filePath: Schema.String })`。
它有两个身份：编译期类型 + 运行期校验器。

问题来了：手写 JSON Schema 是**第三份**信息。一份参数，三处定义（类型 interface、
execute 的 as 断言、手写 JSON Schema），改一处忘另两处就乱了。

### "三份信息"到底在哪？

"三份"听起来抽象，但看阶段 13 之前**真实的 `src/tool/read.ts`** 就一目了然：
`read` 工具的参数"filePath 是字符串"这一个事实，确实被写在了三处。

**第 1 份：类型（写给编译器看的）**

```typescript
// 阶段 13 之前 read.ts 的 execute 签名
async function execute(args: Record<string, unknown>): Promise<string> {
```

`Record<string, unknown>` 就是"类型信息"——但它太宽泛了（任何对象都行），
等于没约束。理想中应该写 `{ filePath: string }`，可当时参数来自 `JSON.parse`
（返回 any），TS 帮不上忙，就退化成了 `Record`。

**第 2 份：运行期校验（agent-loop 解析参数时用的）**

```typescript
// 阶段 13 之前 agent-loop.ts
const args = JSON.parse(tc.function.arguments)   // 无校验，类型 any
const filePath = args.filePath as string          // 靠 as 断言硬转
```

`as string` 不是校验——它只是对编译器说"别管我，我确定它是 string"。
真正的运行期检查（"是不是真有个 filePath 字段？是不是字符串？"）当时**根本不存在**。

**第 3 份：JSON Schema（写给 LLM 看的）**

```typescript
// 阶段 13 之前 read.ts 的参数定义
const parameters: JSONSchema = {
  type: "object",
  properties: { filePath: { type: "string", description: "要读取的文件路径" } },
  required: ["filePath"],
}
```

这是手写的第三份，描述"LLM 你调用 read 时要传 filePath，字符串"。

三份描述的是同一件事，却各写各的：

```
        read 工具的参数：filePath 是 string
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
    类型信息      运行期"校验"    JSON Schema
    execute      JSON.parse    手写 parameters
    args:         + as 断言      { type, properties,
    Record       （其实没有      required }
    （很宽泛）     真校验）
```

三份都是同一个事实的**不同投影**（类型投影 / 校验投影 / LLM 投影），
但当时是**手工分别维护**的：

- 想加个 `offset` 字段？改 `parameters`（给 LLM）+ 改 `execute` 里取参数的地方，
  两处要同步，漏一处 LLM 就不知道有新参数，或者 execute 读不到。
- 想修类型？`Record<string, unknown>` 和 `as` 断言根本不是真类型。

所以"改了 A 忘了 B 就乱套"。

## 2. 关键桥梁：Schema.toJsonSchemaDocument

`Schema.toJsonSchemaDocument` 是 effect 内置的一个**转换器**：输入 Effect Schema，
输出 JSON Schema 文档。

```typescript
const doc = Schema.toJsonSchemaDocument(Parameters)
// doc.schema 就是：
// { type: "object", properties: { filePath: { type: "string" } }, required: ["filePath"] }
```

类比 Python：**pydantic 的 `model_json_schema()`**——`class User(BaseModel): name: str`，
然后 `User.model_json_schema()` 自动生成 JSON Schema。你只需要定义一份模型，
JSON Schema 是白送的。effect 的 `toJsonSchemaDocument` 干的就是同样的事。

> 注意命名：`toJsonSchema` 是"to JSON Schema"（转成 JSON Schema），不是"tool JSON Schema"。

## 3. 那 normalize 在清洗什么？

`Schema.toJsonSchemaDocument` 直接输出的 JSON Schema 有噪音，尤其 **optional（可选）字段**。
看 edit 工具的 `replaceAll`（可选布尔）：

```jsonc
// Schema.toJsonSchemaDocument 直接输出（有噪音）：
"replaceAll": {
  "anyOf": [
    { "type": "boolean" },
    { "type": "null" }        // ← 表示"可以不传"，但 LLM 看到 null 会困惑
  ]
}
```

而我们要给 LLM 看的是干净的：

```jsonc
"replaceAll": { "type": "boolean" }   // 可选字段：不列进 required 就够了
```

`normalize` 就是干这个的。清洗规则（见 `src/tool/tool.ts` 的 normalize）：

```
1. anyOf 里去掉 null 分支
2. 只剩一个分支 → 展开成普通字段（丢掉 anyOf 包装）
3. 嵌套的 anyOf 递归处理
```

清洗前（`anyOf: [boolean, null]`）和清洗后（`{ type: "boolean" }`）的对比，
可以在 `src/tool/tool.ts` 的 normalize 注释里看到，description 也保住了。

## 4. 串起来看这个函数做了什么

```typescript
export function toJSONSchema(schema) {
  // 第 1 步：Effect Schema → JSON Schema 文档（pydantic 的 model_json_schema）
  const document = Schema.toJsonSchemaDocument(schema, { additionalProperties: true })
  // 第 2 步：清洗 optional 字段的 anyOf 噪音，得到干净的、给 LLM 看的版本
  return normalize(document.schema)
}
```

**一句话**：`toJSONSchema` 把工具的一份 Effect Schema 定义，变成 LLM 能看懂的
JSON Schema——这样"类型、校验器、给 LLM 的参数格式"三样东西都从同一份定义派生，
不会不一致。

## 5. 为什么叫"单一来源"

还记得第 1 节那"三份手写"吗？现在工具文件里只写一份 `Parameters`：

```typescript
export const Parameters = Schema.Struct({ filePath: Schema.String })
```

三种用途自动派生（也就是那三份投影，现在都从这一处来）：

| 用途 | 代码 | 给谁 | 之前手写在哪 |
|------|------|------|-------------|
| 类型（编译期） | `Schema.Schema.Type<typeof Parameters>` | 编译器 | `execute(args: Record<string, unknown>)`（还很宽泛） |
| 校验器（运行期） | `Schema.decodeUnknownEffect(Parameters)` | agent-loop | `JSON.parse` + `as string` 断言（其实没有真校验） |
| JSON Schema | `toJSONSchema(Parameters)` | LLM | 手写 `parameters: JSONSchema` |

改一处，三处同步——这就是单一来源（single source of truth）。
对比第 1 节："一个事实，三处手写" → 现在："一个事实，一处定义，三处派生"。

## 6. additionalProperties: true 是什么？

`Schema.toJsonSchemaDocument(schema, { additionalProperties: true })` 的第二个参数：
允许 JSON Schema 里出现**未在 properties 里声明的额外字段**也不报错。

opencode 也这么做（`tool/json-schema.ts` 里传 `{ additionalProperties: true }`）：
LLM 偶尔多塞一个字段进去，不至于校验失败。宽容一点，换来稳定性。

## 跑一下

教学 demo 已清理，可通过 git 历史查看。实际代码：`src/tool/tool.ts` 的
`toJSONSchema()`（含 normalize）。想让某个工具出 JSON Schema，直接跑
`bun run src/index.ts` 让 agent 调该工具，`--debug` 模式能看到发给 LLM 的 JSON Schema。
