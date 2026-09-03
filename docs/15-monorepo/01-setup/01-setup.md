# 15.1 第 1 步：配置 Bun workspaces + tsconfig paths

> 对照代码：`package.json`（root）、`tsconfig.json`

## 这一步做什么

让项目"认识"多包结构：告诉 Bun 哪些目录是独立 package（workspaces），
告诉 tsc 包名映射到哪个文件（paths）。

## 操作 1：root package.json 加 workspaces

```jsonc
// package.json
{
  "name": "opencode-from-scratch",
  "private": true,
  "workspaces": ["packages/*"],   // ← 新增：packages/ 下每个目录是一个独立 package
  "scripts": { ... },
  "devDependencies": { ... }
}
```

`workspaces: ["packages/*"]` 是 Bun/npm/yarn 共有的 monorepo 声明：
- `packages/*` 是通配符，匹配 `packages/schema`、`packages/opencode` 等
- Bun 会为每个匹配的目录建立依赖链接（子包的依赖放进子包的 node_modules）

类比 Python：相当于把多个独立项目放进一个仓库，每个子目录有自己的 `pyproject.toml`。

## 操作 2：tsconfig.json 加 paths 别名

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

- `paths`：路径别名映射。tsc 看到 `@opencode-from-scratch/schema` 就替换成
  `./packages/schema/src/index.ts`
- `include` 加 `packages/**/*.ts`：让 tsc 也检查 schema 包的类型

> 为什么用 paths 而不是 node_modules 软链？
> Bun workspaces 默认会在 `node_modules/@opencode-from-scratch/schema` 建软链。
> 但 tsc 解析软链有时会出问题，且需要 `bun install` 触发。paths 别名是
> 纯声明式的，bun（运行时）和 tsc（类型检查）都能直接解析，对教学项目最直观。

## 操作 3：建空 schema 包 + 装依赖

```bash
mkdir -p packages/schema/src
bun install   # 让 Bun 识别新 workspace
```

此时 `packages/schema/` 还是空的。下一步（15.2）才填内容。

## 验证：第 1 步成功标志

```bash
bunx tsc --noEmit    # 通过（原 src/ 和空 packages/ 共存，没有新错误）
```

## 一个教学点：paths 别名的两种角色

- **运行时（Bun）**：靠 `workspaces` 的 node_modules 链接 + package.json 的 `exports` 解析包名
- **类型检查（tsc）**：靠 tsconfig 的 `paths` 解析包名

两者都要配，缺一个就报错：
- 只配 workspaces 不配 paths → Bun 能跑，`bunx tsc --noEmit` 报 "Cannot find module"
- 只配 paths 不配 workspaces → tsc 能过，`bun run` 运行时找不到包

## 对照 opencode

opencode 的根 `package.json` 也有 workspaces（`opencode/package.json`），
配置思路完全一致。它更复杂的地方是用了 `catalog:`（依赖版本集中管理），
我们暂不需要。

## 小结

第 1 步做完，项目"知道"自己是个 monorepo 了，但还没拆任何东西——
只有骨架（workspaces + paths），没有实际内容。

## 下一步

[15.2 第 2 步：建 schema 契约层](../02-schema-package/01-schema-package.md)
——把共享类型搬进 schema 包，用 Effect Schema 重写。
