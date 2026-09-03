# 15.1 Monorepo 是什么 + Bun workspaces 配置

> 对照代码：`package.json`、`tsconfig.json`、`packages/schema/package.json`

## 为什么现在要拆 monorepo

回顾项目结构。到目前为止所有代码都在根目录 `src/` 下，是一个**单 package**：

```
opencode-from-scratch/
├── package.json     # 一个 package
└── src/             # 所有代码（类型、业务、工具、UI 全混在一起）
```

问题在哪？**类型定义和业务逻辑混在一起，边界模糊**：

- `src/types.ts` 里定义共享类型（Message、ToolCall...）
- 但 `src/service/config.ts` 里又**重复定义**了一个本地 `Config` interface
- 类型散落在各文件，没有统一归属，谁都能改，改了别处不知道

opencode 怎么解决？**monorepo（多包仓库）**——把项目拆成多个 package，每个 package 职责单一，
通过依赖关系组织。opencode 有 37 个 package：

```
packages/
├── schema/      # 叶子节点：领域契约（类型）——只依赖 effect，什么都不依赖它之上
├── core/        # 领域逻辑
├── llm/         # LLM 抽象
├── protocol/    # HTTP API 定义
└── opencode/    # 主应用
```

依赖方向：上 → 下，**下层不知道上层存在**。`schema` 在最底层，被所有包共享。

## 核心概念：契约层（Contract Layer）

**契约层 = 定义"世界长什么样"的地方**。

`schema` 包就是契约层——它只描述类型（Message 长什么样、ToolCall 长什么样），
**不包含任何业务逻辑**。它只依赖 `effect`（因为用 Effect Schema 定义），
是整棵依赖树的叶子。

任何上层包要用这些类型，就从 `@opencode-from-scratch/schema` 导入。
这样：
- **一份定义，多方共享**：Message 只定义一次，CLI、TUI、agent-loop 都用它
- **消除重复**：config.ts 里重复的 Config 定义被收编进 schema 包
- **边界清晰**：改类型只动 schema 包，上层知道去哪里找

## Bun workspaces：配置多包

### 1. root package.json 声明 workspaces

```jsonc
// package.json
{
  "workspaces": ["packages/*"]  // 告诉 Bun：packages/ 下每个目录都是一个独立 package
}
```

`workspaces` 字段是 Bun/npm/yarn 共有的 monorepo 机制：声明"哪些目录是子包"。
`packages/*` 是通配符——`packages/schema`、`packages/core` 等都会被视为独立 package。

类比 Python：`workspaces` 有点像把多个独立项目放进一个仓库统一管理，
每个子目录有自己的 `package.json`（相当于各自的 `pyproject.toml`）。

### 2. 子包自己的 package.json

```jsonc
// packages/schema/package.json
{
  "name": "@opencode-from-scratch/schema",  // 包名（@scope/name 格式）
  "private": true,                          // 不发布到 npm
  "type": "module",
  "exports": {                              // 导出入口
    ".": "./src/index.ts"                   // import 包名 → 这个文件
  },
  "dependencies": {
    "effect": "^4.0.0-beta.97"              // schema 包只依赖 effect（叶子）
  }
}
```

关键：`"exports": { ".": "./src/index.ts" }`——别人 `import { Message } from
"@opencode-from-scratch/schema"` 时，实际加载的是 `packages/schema/src/index.ts`。

### 3. tsconfig paths 别名：让 TS 认识包名

Bun 运行时能直接解析包名（通过 workspaces），但 **tsc 需要知道包名指向哪个文件**。
在 root tsconfig 加 paths：

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],                                    // 已有的 @/ 别名
      "@opencode-from-scratch/schema": ["./packages/schema/src/index.ts"]  // 新增
    }
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "packages/**/*.ts"]  // 也检查 packages
}
```

- `paths` 是"路径别名映射"：编译器看到包名，替换成真实路径
- `include` 加上 `packages/**/*.ts`：让 tsc 也检查 schema 包的类型

> 这就是为什么我们说"paths 别名"方案：不需要 `bun link` 或 build 步骤，
> bun（运行时）和 tsc（类型检查）都能直接解析。真实 monorepo 会用
> workspaces 的 node_modules 软链，但对我们教学项目，paths 别名足够且更直观。

## 对照 opencode

opencode 的 schema 包：`opencode/packages/schema/package.json`：

```jsonc
{
  "name": "@opencode-ai/schema",
  "private": true,
  "exports": {
    ".": "./src/index.ts",
    "./*": "./src/*.ts"
  },
  "dependencies": {
    "effect": "catalog:"     // catalog: 是 workspace 版本管理（我们暂不用）
  }
}
```

它的 `src/index.ts` 是个 barrel（统一出口），导出 28 个领域 schema：
`Session`、`Message`、`ToolCall`、`Provider`、`Permission`... 我们用 5 个
（`ToolCall`/`Message`/`ProviderConfig`/`Config`/`ResolvedConfig`），思路完全一致。

## 阶段 15.1 小结

1. **monorepo**：一个仓库多个 package，职责单一、依赖清晰
2. **契约层**：schema 包定义共享类型，是依赖树叶子
3. **workspaces**：root `package.json` 的 `workspaces: ["packages/*"]` 声明子包
4. **paths 别名**：tsconfig 把包名映射到真实文件，bun + tsc 都能解析

## 下一步

[15.2 Schema 契约层：把共享类型搬到 schema 包](../02-schema-package/01-schema-package.md)
——把 `src/types.ts` 的类型搬进 schema 包，用 Effect Schema 重写。
