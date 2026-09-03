# 15.4 第 4 步：主应用 src → packages/opencode

> 对照代码：`packages/opencode/package.json`、`package.json`（root）、`tsconfig.json`

## 这一步做什么

第 1-3 步只拆了 schema 包，业务代码还在根 `src/`。这步把整个 `src/` 搬进
`packages/opencode/src/`，形成 `packages/{schema, opencode}` 两层结构——
对齐 opencode 的最终形态（主应用在 `packages/opencode/`）。

## 为什么这步"现在做"而不是"以后做"

最初设计只做 schema 包，主应用留在 src/。但经过评估：
- **这只是工程量**（搬文件 + 改路径），不涉及任何概念重构
- **后面没有专门课程**负责"把主应用收进 package"这件事
- 对照 opencode，主应用最终一定在 `packages/opencode/`

所以趁现在做，结构一步到位。判断标准（00-overview 提过）：
> 如果拆分只是搬文件、改路径，而且没有后续课程专门做，就现在做；
> 涉及概念重构的（core 服务化、Route 四轴）留到对应阶段。

## 操作 1：git mv 搬移整个 src

```bash
# 建主应用包目录
mkdir -p packages/opencode

# 用 git mv（不是 mv）——保留文件历史
git mv src packages/opencode/src
```

为什么用 `git mv` 而不是 `mv`：
- `git mv` 移动后，git 能识别为 **rename**（`R`），保留历史
- 如果直接 `mv`，git 会当成 delete + add，丢失"这个文件以前在哪"的追踪
- 验证：`git status` 里应该显示 33 个 `R src/xxx -> packages/opencode/src/xxx`

搬完后目录结构：

```
packages/opencode/
└── src/
    ├── agent-loop.ts
    ├── provider/
    ├── tool/
    ├── service/
    ├── tui/
    └── ...
```

**关键**：因为内部都是相对路径导入（`./`、`../`），整体搬移后相对关系不变，
**import 一行都不用改**。（我们检查过 `@/` 别名没有任何文件使用，所以 paths
不用跟着改 import，只改映射目标即可。）

## 操作 2：写 packages/opencode/package.json

主应用包需要自己的 package.json（name、scripts、依赖）：

```jsonc
// packages/opencode/package.json
{
  "name": "opencode-from-scratch",      // 主应用包名（opencode 的主应用就叫 opencode）
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "bun run src/index.ts",      // 在包目录内运行时，路径是 src/index.ts
    "tui": "bun run src/tui/hello.tsx",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@opencode-from-scratch/schema": "workspace:*",  // 依赖 schema 包（workspace 链接）
    "@opentui/core": "^0.4.3",
    "@opentui/solid": "^0.4.3",
    "effect": "^4.0.0-beta.97",
    "yargs": "^18.0.0",
    "drizzle-orm": "^0.45.2",
    "opentui-spinner": "^0.0.7",
    "solid-js": "^1.9.14"
  },
  "devDependencies": {
    "@tsconfig/bun": "latest",
    "@types/bun": "latest",
    "@types/yargs": "^17.0.35",
    "typescript": "latest"
  }
}
```

关键点：
- `"@opencode-from-scratch/schema": "workspace:*"`：依赖 schema 包。
  `workspace:*` 是 Bun workspaces 的语法——链接到本仓库的 packages/schema，
  不用从 npm 下载
- 运行时依赖（opentui/effect/yargs 等）收进这个包——这是它们真正的使用者

## 操作 3：更新 root package.json（脚本转发）

root 变成"聚合点"，scripts 转发到子包：

```jsonc
// package.json（root）
{
  "workspaces": ["packages/*"],
  "scripts": {
    "dev": "bun run packages/opencode/src/index.ts",        // 指向子包
    "tui": "bun run packages/opencode/src/tui/hello.tsx",
    "tui:debug": "bun --inspect=... packages/opencode/src/tui/agent.tsx",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@tsconfig/bun": "latest",
    "@types/bun": "latest",
    "typescript": "latest"    // tsc 在 root，供 typecheck
  }
}
```

root 的依赖大幅精简——运行时依赖都收进 packages/opencode 了，
root 只留 tsc 相关的（供 typecheck 用）。

## 操作 4：更新 tsconfig.json（paths + include）

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./packages/opencode/src/*"],              // @/ 指向新位置
      "@opencode-from-scratch/schema": ["./packages/schema/src/index.ts"]  // 不变
    }
  },
  "include": ["packages/**/*.ts", "packages/**/*.tsx"]   // 现在只有 packages
}
```

- `@/*` 的映射目标从 `./src/*` 改成 `./packages/opencode/src/*`
- `include` 简化为 `packages/**/*`（src/ 已经不存在了）

## 操作 5：bun install + typecheck

```bash
bun install          # 让 Bun 建立新 workspace 链接
bunx tsc --noEmit    # 类型检查
```

如果 `bun install` 后 `bunx tsc --noEmit` 通过，第 4 步完成。

## 验证：第 4 步成功标志

```bash
git status     # 33 个文件都显示 R（rename），不是 D+A
bunx tsc --noEmit   # 通过
```

注意此时直接跑 CLI 可能报 preload 错误（第 5 步解决）：

```bash
bun run packages/opencode/src/index.ts run "你好"
# 可能报: error: preload not found "@opentui/solid/preload"
```

## 为什么搬移后 preload 会坏

`@opentui/solid` 依赖从 root 移到了 `packages/opencode/node_modules`。
但 root 的 `bunfig.toml` 里 preload 写的是包名 `"@opentui/solid/preload"`，
Bun 从 root 运行时按包名解析，root 的 node_modules 里已经没有它了。
这个问题在第 5 步解决。

## 小结

第 4 步做完，真正的两层 monorepo 形成：
```
packages/schema    契约层（类型）
packages/opencode  主应用（业务代码）
```
git 用 rename 保留了历史，root 变成聚合点。

## 下一步

[15.5 第 5 步：修 bunfig preload 坑](../05-preload-fix/01-preload-fix.md)
——让 CLI 和 TUI 能跑。
