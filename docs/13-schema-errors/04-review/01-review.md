# 13.4 阶段验收

## 验收清单

- [x] 能写出 `Schema.Struct` 定义数据契约
- [x] 能使用 `Schema.decodeUnknownSync` / `decodeUnknownEffect` 做运行时校验
- [x] 理解 Schema 的双重身份：编译期类型 + 运行期校验器
- [x] 能写出 `Data.TaggedError("Name")<{...}>` 定义类型化错误
- [x] 能使用 `Effect.catchTag("TagName")` 精确捕获特定错误
- [x] 能使用 `Effect.catch` 做兜底捕获
- [x] Schema 落地：工具参数用 Effect Schema 定义（单一来源），agent-loop 里实际校验

## 验证方式

```bash
bun run typecheck              # 类型检查：Tool 泛型、Schema 推导全通过
```

阶段 13 的教学 demo（`schema-demo.ts` 等）已清理，可通过 git 历史查看。
实际落地验证：让 agent 调 read 工具传错误参数，校验失败信息会作为工具结果返回。

## 工程思维

**1. Schema 的双重身份**

以前你需要两份代码：`interface User { ... }`（类型）+ `function validateUser(input) { ... }`（校验）。Schema 一份代码同时提供两者——定义即类型，定义即校验。

**2. TaggedError 让错误"可区分"**

`throw new Error("字符串")` 的问题是：所有错误都是 `Error` 类型，调用方无法区分。靠 `e.message.includes("配置")` 区分是脆弱的——信息变了就失效。TaggedError 用 tag 区分，编译期安全。

**3. 单一来源消灭"两份定义不一致"**

工具参数以前有手写 JSONSchema（给 LLM）+ `Record<string, unknown>`（运行期）两份。现在 Effect Schema 一份，类型、校验、JSON Schema 三者自动派生。改一处，三处同步。

**4. 错误要"喂回去"而不是"中断"**

agent loop 里工具参数校验失败，不应该中断整个对话，而应该把错误文本作为工具结果喂回给 LLM，让它下一步自纠正（opencode 的 `InvalidArgumentsError` 设计）。

**5. mapError 的作用域**

`mapError` 只应包在"需要转换的那个阶段"（Schema 解码），而不是整个 Effect 链。包在整个链上，`Effect.try`（JSON.parse）阶段的 ToolError 也会被二次包装，错误文本冗余。

## 阶段产出

```
src/
├── error/
│   └── errors.ts           # ConfigError / LLMError / ToolError
├── tool/
│   ├── tool.ts             # Tool 泛型接口 + toJSONSchema（单一来源）
│   └── read.ts 等 6 个工具   # Effect Schema 定义参数
├── agent-loop.ts           # Schema.decodeUnknownEffect 校验工具参数
└── service/
    └── config.ts           # 已使用 ConfigError
```

## 下一步

阶段 14：Effect Stream——把 chatWithTools 的流式输出从 ReadableStream 改成 Effect Stream。