# 13.4 阶段验收

## 验收清单

- [ ] 能写出 `Schema.Struct` 定义数据契约
- [ ] 能使用 `Schema.decodeUnknownSync` 做运行时校验
- [ ] 理解 Schema 的双重身份：编译期类型 + 运行期校验器
- [ ] 能写出 `Data.TaggedError("Name")<{...}>` 定义类型化错误
- [ ] 能使用 `Effect.catchTag("TagName")` 精确捕获特定错误
- [ ] 能使用 `Effect.catch` 做兜底捕获

## 验证方式

```bash
bun run src/schema-demo.ts
```

预期输出 5 个节：Schema 基础、双重身份、工具参数校验、精确捕获、兜底捕获。

## 工程思维

**1. Schema 的双重身份**

以前你需要两份代码：`interface User { ... }`（类型）+ `function validateUser(input) { ... }`（校验）。Schema 一份代码同时提供两者——定义即类型，定义即校验。

**2. TaggedError 让错误"可区分"**

`throw new Error("字符串")` 的问题是：所有错误都是 `Error` 类型，调用方无法区分。靠 `e.message.includes("配置")` 区分是脆弱的——信息变了就失效。TaggedError 用 tag 区分，编译期安全。

**3. 渐进式采用**

Schema 和 TaggedError 不需要一次性应用到所有代码。`agent-loop.ts` 目前用 try/catch 包裹 JSON.parse 做容错，后续可以逐步替换成 Schema 校验。`config.ts` 已经用了 ConfigError，其他文件可以逐步迁移。

## 阶段产出

```
src/
├── error/
│   └── errors.ts           # ConfigError / LLMError / ToolError
├── schema-demo.ts          # Schema + TypedError 演示
├── agent-loop.ts           # 已导入 ToolError（后续使用）
└── service/
    └── config.ts           # 已使用 ConfigError
```

## 下一步

阶段 14：Effect Stream——把 chatWithTools 的流式输出从 ReadableStream 改成 Effect Stream。