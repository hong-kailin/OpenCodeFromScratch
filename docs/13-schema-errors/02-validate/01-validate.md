# 13.2 用 Schema 校验工具参数

> 对照代码：`src/schema-demo.ts` 第 3 节

## 真实场景

每个工具的参数格式不同。LLM 返回的 `arguments` 是 JSON 字符串，需要解析 + 校验。

```typescript
// read 工具：只需要 filePath
const ReadArgs = Schema.Struct({
  filePath: Schema.String,
})

// write 工具：需要 filePath + content
const WriteArgs = Schema.Struct({
  filePath: Schema.String,
  content: Schema.String,
})
```

## 工具参数校验

```typescript
// LLM 返回的参数（JSON 字符串 → 解析 → 校验）
const args = Schema.decodeUnknownSync(ReadArgs)(
  JSON.parse(tc.function.arguments)
)
// args 类型安全：{ filePath: string }
// 如果参数不对，抛 ParseError
```

## 对比：Schema 校验 vs 裸 JSON.parse

```
裸 JSON.parse：
  const args = JSON.parse(str)  // any 类型，无校验
  如果 LLM 返回错误参数 → 静默失败或运行时崩溃

Schema 校验：
  const args = Schema.decodeUnknownSync(Schema)(JSON.parse(str))
  如果参数不对 → 立即抛 ParseError，带详细错误信息
  如果参数正确 → 类型安全的 args
```

## 当前项目中的应用

`src/agent-loop.ts` 目前用 try/catch 包裹 JSON.parse 做容错。将来可以给每个工具定义参数 Schema，在 `tool.execute` 之前校验。

## 跑一下

```bash
bun run src/schema-demo.ts
```

看第 3 节：合法参数通过，非法参数被拦截并打印具体错误。