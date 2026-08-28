# 13.3 Typed Errors：精确捕获

> 对照代码：`src/schema-demo.ts` 第 4-5 节、`src/error/errors.ts`

## 当前问题：裸 Error

```typescript
throw new Error("配置文件里找不到 provider")
// 调用方只能 catch (e) { if (e.message.includes("配置")) ... }
// 靠字符串匹配区分错误类型——脆弱！
```

## 解法：Data.TaggedError

```typescript
import { Data } from "effect"

// 每种错误有唯一 tag
export class ConfigError extends Data.TaggedError("ConfigError")<{
  readonly message: string
}>() {}

export class LLMError extends Data.TaggedError("LLMError")<{
  readonly message: string
}>() {}
```

## 精确捕获：Effect.catchTag

```typescript
const program = Effect.gen(function* () {
  // 可能产生 ConfigError 或 LLMError
  return yield* Effect.fail(new ConfigError({ message: "配置不存在" }))
})

const handled = program.pipe(
  Effect.catchTag("ConfigError", (e) =>
    Effect.succeed(`配置错误: ${e.message}`),  // 只处理 ConfigError
  ),
  Effect.catchTag("LLMError", (e) =>
    Effect.succeed(`LLM 错误: ${e.message}`),  // 只处理 LLMError
  ),
)
```

## 对比：TaggedError vs 裸 Error

```
裸 Error：
  catch (e) {
    if (e.message.includes("配置")) { ... }     // 靠字符串匹配
    else if (e.message.includes("超时")) { ... } // 脆弱、易错
  }

TaggedError：
  Effect.catchTag("ConfigError", (e) => ...)  // 靠 tag 精确匹配
  Effect.catchTag("LLMError", (e) => ...)     // 编译期安全
```

## 兜底捕获：Effect.catch

```typescript
program.pipe(
  Effect.catchTag("ConfigError", ...),  // 精确捕获
  Effect.catchTag("LLMError", ...),     // 精确捕获
  Effect.catch((e) => ...),             // 兜底：捕获所有其余错误
)
```

## 项目中的应用

`src/error/errors.ts` 定义了三种错误类型：
- `ConfigError`：配置错误（已在 `src/service/config.ts` 中使用）
- `LLMError`：LLM 调用错误
- `ToolError`：工具执行错误

`src/agent-loop.ts` 已导入 `ToolError`，后续可以精确捕获工具错误。

## 跑一下

```bash
bun run src/schema-demo.ts
```

看第 4-5 节：catchTag 精确捕获，catch 兜底。