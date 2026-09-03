# 15.5 第 5 步：修 bunfig preload 坑

> 对照代码：`bunfig.toml`（root）

## 这一步做什么

第 3 步搬完主应用后，CLI 和 TUI 会报一个错：

```
error: preload not found "@opentui/solid/preload"
```

本课讲清楚：这个错从哪来、为什么迁移会触发它、怎么修。

## 先搞清楚 preload 是干嘛的

`bunfig.toml` 里的 `preload = ["@opentui/solid/preload"]` 是给 Bun 的一个
"启动前插件"。它做两件事（9.2 课讲过）：
1. 修复 solid-js 构建选择：Bun 按 `"node"` 导出条件解析 solid-js 时会拿到
   `dist/server.js`（SSR 构建，`createEffect` 是空操作）。preload 插件拦截加载，
   重定向到 `dist/solid.js`（真正的响应式构建）。没有它，所有响应式 API 静默失效。
2. 用 babel-preset-solid 编译 `.tsx`。

所以 preload 对 TUI 是**必需的**——不是可选的。

## 迁移为什么触发这个错

**迁移前**（单 package）：`@opentui/solid` 在 root 的 node_modules，Bun 从 root
跑，按包名 `"@opentui/solid/preload"` 能解析到。

**迁移后**（monorepo）：`@opentui/solid` 被收进 `packages/opencode/package.json`，
workspaces 把它装进 `packages/opencode/node_modules`。但：
- root 的 `bunfig.toml` 还是写着包名 `"@opentui/solid/preload"`
- Bun 从 root 运行时，在 **root 的 node_modules** 里找这个包 → 找不到 → 报错

**根因**：preload 的解析是相对"当前工作目录"（root）的，而依赖已经搬进了子包。

```
迁移前                        迁移后
root/node_modules            root/node_modules (没有 opentui)
  @opentui/solid  ← 找到      packages/opencode/node_modules
                               @opentui/solid  ← 在这里
bunfig preload="包名"          bunfig preload="包名" → root 找不到！
```

## 解法：preload 用相对路径指向子包

**为什么不用"每个包自带 bunfig"（opencode 的做法）**：Bun 发现 bunfig.toml 是
从**当前工作目录**向上查找的。我们项目统一从 root 运行（`bun run dev`），
所以只会读 root 的 bunfig.toml，`packages/opencode/bunfig.toml` 即使存在**也不生效**。
opencode 之所以能每包自带，是因为它每个包从自己目录内运行（`cd packages/tui && bun run dev`）。

所以对我们"root 统一入口"的项目，正确解法是让 root 的 preload **直接用相对路径
指向子包 node_modules 里的 preload 文件**：

```toml
# bunfig.toml（root）
preload = ["./packages/opencode/node_modules/@opentui/solid/scripts/preload.js"]
```

为什么这样能行：相对路径不依赖"包解析"，Bun 从 root 直接按路径找文件，
跨过 node_modules 解析，一定能找到。

## 验证：第 5 步成功标志

```bash
bun run packages/opencode/src/index.ts run "你好"
# CLI 正常：配置加载、请求、流式输出

bun run packages/opencode/src/tui/hello.tsx
# TUI 能启动（全屏渲染，没有 preload 报错）
```

## 这个坑教了什么

1. **monorepo 拆包不只是搬文件**——依赖位置变了，运行时解析路径也跟着变。
   preload、bunfig、env 这类"隐式配置"最容易在迁移后悄悄坏掉。
2. **报错信息指向明确**："preload not found" 直接说找不到 preload。
   排查思路：找到依赖实际装在哪（`packages/opencode/node_modules`），
   再看配置怎么解析的（root 上下文按包名 → 找不到）。
3. **教 debug 手法**：遇到这种问题，先 `Test-Path` / `ls` 确认依赖在哪，
   再想"配置解析时的工作目录是哪里"，不要盲目改代码。

## 对照 opencode

opencode 的 `packages/tui/bunfig.toml`：

```toml
preload = ["@opentui/solid/preload"]
```

opencode 每个包自带 bunfig、从包目录内运行（`cd packages/tui && bun run dev`），
所以包名 `"@opentui/solid/preload"` 能解析（依赖就在该包自己的 node_modules）。
我们用 root 统一入口，所以用相对路径——**两种方案对应两种运行方式**，本质都是
"让 preload 能解析到真实存在的文件"。

## 小结

第 5 步做完，整个阶段 15 的迁移完成：CLI 和 TUI 都能跑，两层 monorepo 结构成立。

## 下一步

[15.6 阶段验收](../07-review/01-review.md) —— 完整迁移回顾 + 验收清单 + 工程思维。
