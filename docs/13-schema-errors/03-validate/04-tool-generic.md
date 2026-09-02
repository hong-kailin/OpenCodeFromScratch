# 13.3.4 泛型 Tool 接口：类型安全从哪来

> 对照代码：`src/tool-generic-demo.ts`（可运行的完整演示）、`src/tool/tool.ts`（实际代码）

阶段 13 的 Tool 接口和阶段 3 的旧版长得不一样了。旧版是：

```typescript
export interface Tool {
  id: string
  description: string
  parameters: JSONSchema        // 手写 JSON Schema
  execute(args: Record<string, unknown>): Promise<string>  // 参数类型是"任意对象"
}
```

现在是：

```typescript
export interface Tool<Parameters extends Schema.Decoder<unknown> = Schema.Decoder<unknown>> {
  id: string
  description: string
  parameters: Parameters
  execute(args: Schema.Schema.Type<Parameters>): Promise<string>
}
```

多了一个 `<Parameters extends ...>`。本课拆开讲：这段泛型签名每一部分是什么意思，
它带来了什么类型安全，以及为什么必须用泛型。

## 1. 逐词拆解泛型签名

```
Tool< Parameters extends Schema.Decoder<unknown> = Schema.Decoder<unknown> >
     └─┬─┘   └──────────┬────────────┘   └───────────────┬────────────┘
       泛型参数名        约束（extends）                  默认值
```

| 部分 | 含义 | Python 类比 |
|------|------|------------|
| `Parameters` | 泛型参数名：本工具的参数 Schema | `T`（类型参数） |
| `extends Schema.Decoder<unknown>` | 约束：`Parameters` 必须是"一个 Schema"（能解码 unknown 输入的东西） | `T: Hashable`（类型约束） |
| `= Schema.Decoder<unknown>` | 默认值：不显式传泛型时的兜底（宽容，任何 Schema 都行） | 函数参数默认值 |

类比 Python：

```python
def make_tool(Parameters: type) -> Tool:  # 类型参数，运行时是具体类型
    ...
```

只不过 TS 的泛型在**编译期**就展开，且能**推导** `execute` 的签名——这是 Python 的
普通函数做不到的（Python 类型标注只是 hint，TS 泛型会参与类型检查）。

## 2. 关键：`Schema.Schema.Type<Parameters>` 推导出 execute 的参数类型

接口里最值钱的一行：

```typescript
execute(args: Schema.Schema.Type<Parameters>): Promise<string>
```

`Schema.Schema.Type<Parameters>` 的意思是：**从 Schema 推导出它对应的类型**。

比如 read 工具的参数 Schema 是：

```typescript
const Parameters = Schema.Struct({ filePath: Schema.String })
```

那么 `Tool<typeof Parameters>` 展开后，`execute` 的 `args` 类型自动变成：

```typescript
{ filePath: string }
```

`execute` 函数体里可以直接解构，**不需要 `as` 断言**：

```typescript
async execute(args) {
  const { filePath } = args  // 类型安全！编译器知道有 filePath 且是 string
}
```

## 3. 泛型带来的类型安全：写错字段，编译期就报错

这是最重要的实际收益。对比两种写法：

**旧版 `Record<string, unknown>`**：表示"任意对象"。编译器不知道里面有什么字段，
于是写 `args.filePath` 不报错，写 `args.filePth`（拼错）**也不报错**——编译期零保护，
全靠运行期踩坑（拿到 `undefined` 才暴露）。

**泛型 `Schema.Schema.Type<typeof Parameters>`**：编译器知道 `args = { filePath: string }`。
写错字段直接编译报错：

```
src/__wrong_check.ts(4,26): error TS2561:
Object literal may only specify known properties, but 'filePth' does not exist
in type 'ReadonlySide<{ readonly filePath: String; }, "Type">'.
Did you mean to write 'filePath'?
```

注意报错信息甚至**猜到了你拼错了**（"Did you mean to write 'filePath'?"）——这是
IDE 的自动补全和错误提示在帮你，而不是等到运行期才炸。

> 可以自己验证：新建 `src/__wrong.ts` 写 `await readTool.execute({ filePth: "x" })`，
> 跑 `bunx tsc --noEmit`，会看到上面的错误；删掉即可。

## 4. 为什么必须用泛型（而不是写死一个类型）

如果不用泛型，接口里 `parameters` 只能写死成 `Schema.Decoder<unknown>`：

```typescript
// ❌ 不用泛型：execute 的 args 只能是一个宽泛类型
export interface ToolBad {
  parameters: Schema.Decoder<unknown>
  execute(args: ???): Promise<string>  // 写什么都对不上
}
```

问题：`read` 和 `write` 工具的 `execute` 参数形状不同（一个只有 `filePath`，
一个有 `filePath` + `content`）。写死的话，所有工具共用同一个宽泛类型，
**丢失每个工具自己的参数形状**——又退回到 `Record` 那种"啥都能传"的状态。

泛型让**每个 Tool 实例携带自己的参数类型**：

```typescript
const readTool: Tool<typeof ReadParameters>   // execute 的 args = { filePath: string }
const writeTool: Tool<typeof WriteParameters> // execute 的 args = { filePath, content }
```

同一个接口，两种不同的 `execute` 参数，**都**类型安全。这就是"参数化类型"的意义。

## 5. 泛型和"单一来源"的关系

阶段 13.3 讲"一份 Schema，三种用途派生"（类型 / 校验器 / JSON Schema），
泛型 Tool 接口就是这件事在**接口层面**的落实：

```
一份 Schema：Schema.Struct({ filePath: Schema.String })
        │
        ├── 类型（编译期）     : Schema.Schema.Type<typeof Parameters>  ← Tool 接口的 execute 用它
        ├── 校验器（运行期）   : Schema.decodeUnknownEffect(Parameters)  ← agent-loop 用它
        └── JSON Schema（LLM）: toJSONSchema(Parameters)                ← toolToOpenAIFormat 用它
```

`Tool<Parameters>` 泛型把"这份 Schema"通过类型参数传进接口，`execute` 的签名
自动获得对应的类型——类型安全是**免费送**的，不用手写 interface。

## 6. 一个问题：接口里 Parameters 是从哪拿到的？

你可能注意到：接口里只声明了 `Parameters`，但 read 工具定义时写的是
`Tool<typeof Parameters>`——`Parameters` 是 read.ts 里定义的那个 Schema 常量。

```typescript
// read.ts
export const Parameters = Schema.Struct({ filePath: Schema.String })
// ...
export const readTool: Tool<typeof Parameters> = { parameters: Parameters, execute }
```

`typeof Parameters` 把"这个 Schema 常量的类型"作为泛型实参传进去。TS 据此推导出
`execute` 的参数类型。这就是为什么每个工具文件里都要 `export const Parameters`——
它既是运行期的 Schema 值，又通过 `typeof` 成为编译期的类型来源。

## 跑一下

```bash
bun run src/tool-generic-demo.ts
```

四节输出：
1. 泛型签名逐词拆解（注释）
2. 类型推导：read 的 execute 参数类型安全
3. 对比旧版 Record：编译期零保护 vs 泛型报错
4. 泛型区分不同工具的 execute 参数（read / write）

再加一步验证类型保护：

```bash
# 在 src/ 下建一个临时文件
# await readTool.execute({ filePth: "x" })   ← 拼错
bunx tsc --noEmit   # 会报 TS2561，提示你是不是想写 filePath
```
