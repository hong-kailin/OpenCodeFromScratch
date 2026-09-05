# 16.6 第 6 步：SystemContext 服务——组装 system prompt

> 对照代码：`packages/core/src/system-context.ts`

## 这一步做什么

把第 1 步搬进来的 `system-context.ts`（模块级函数 buildSystemPrompt）改造成
SystemContext Service。

## 之前的问题

`system-context.ts` 是一个模块级函数：

```typescript
export function buildSystemPrompt(): string {
  const role = "你是一个编程助手..."
  const env = buildEnvironmentInfo()      // 环境信息
  const instructions = loadInstructions() // AGENTS.md
  return [role, env, instructions].join("\n\n")
}
```

问题：
1. **模块级函数**——CLI 和 TUI 都直接 import 调用，无法替换实现
2. **组装逻辑无法 mock**——测试时想控制"环境信息"或"AGENTS.md"很麻烦
3. **不是服务**——与其他服务（Config/Provider/SessionStore）不统一

## SystemContext Service：三件套

```typescript
// packages/core/src/system-context.ts
import { Context, Effect, Layer } from "effect"
import { existsSync, readFileSync } from "fs"

export interface SystemContextApi {
  readonly build: () => Effect.Effect<string>
}

export class SystemContext extends Context.Service<SystemContext, SystemContextApi>()(
  "opencode-from-scratch/SystemContext",
) {}

export const systemContextLayer = Layer.effect(
  SystemContext,
  Effect.sync(() =>
    SystemContext.of({
      build: Effect.fn("SystemContext.build")(function* () {
        const role = "你是一个编程助手..."
        const env = buildEnvironmentInfo()
        const instructions = loadInstructions()
        return [role, env, instructions].join("\n\n")
      }),
    }),
  ),
)
```

**注意**：`build()` 每次调用都重新组装（日期会变、AGENTS.md 可能改）——和阶段 7
学的"每次调用重新组装"一致。文件读写是同步的（readFileSync），用 `Effect.sync` 包。

## 对照 opencode：registry 模式（我们简化了）

opencode 的 SystemContext 用 **registry 模式**（`core/src/system-context/registry.ts`）：

```typescript
// opencode 的做法：注册多个组件，load 时合并
export interface Interface {
  readonly register: (entry: { key, load }) => Effect.Effect<void>
  readonly load: () => Effect.Effect<SystemContext>
}
```

它把 system prompt 拆成多个**可注册的组件**（base + env + instructions + mcp + ...），
谁想加一段就 register 一个。我们用单个 Service 简化——因为我们的 system prompt
组件还很少（角色 + 环境 + AGENTS.md），不需要 registry 的复杂度。

**判断标准**：什么时候该演进成 registry？当 system prompt 的组件变多、
且不同的 agent（阶段 21）需要不同的组件组合时，再升级。现在先单服务。

## 验证：第 6 步成功标志

```bash
bunx tsc --noEmit    # 通过（SystemContext Service 成立）
```

## 工程思维：服务化的统一性

到这一步，core 包里的领域逻辑全部服务化了：

| 领域 | 服务 |
|------|------|
| 配置 | ConfigService |
| LLM 调用 | ProviderService |
| 文件系统 | FileSystemService |
| 工具注册 | ToolRegistry |
| 数据库 | DatabaseService |
| 会话/消息存储 | SessionStore |
| system prompt | SystemContext |

统一的模式（三件套）+ 统一的取用方式（`yield* Service`）——这是服务化的真正价值：
**所有领域逻辑都用同一种语言表达依赖关系**。

## 下一步

[16.7 第 7 步：上层接入 + 验收](../07-integration/01-integration.md)
——CLI/TUI 改成 yield* core 服务，删除所有兼容层。
