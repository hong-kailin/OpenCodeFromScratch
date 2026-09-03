# 15.0 迁移总览：从单 package 到 monorepo

> 本课是整个阶段 15 的"地图"。先看清我们要从哪里走到哪里、分几步走，
> 再进入后续每一课看具体怎么操作。

## 起点：单 package 的结构（阶段 14 结束时）

```
opencode-from-scratch/
├── package.json          # 唯一的 package（依赖、scripts 全在这）
├── tsconfig.json
├── bunfig.toml           # preload: ["@opentui/solid/preload"]
└── src/                  # 所有代码：类型、业务、工具、UI 混在一起
    ├── types.ts          # 共享类型（ToolCall、Message...）
    ├── agent-loop.ts
    ├── provider/
    ├── tool/
    ├── service/
    ├── tui/
    └── ...
```

**问题**（阶段 15 要解决的）：
1. 类型和业务混在一起，边界模糊
2. `service/config.ts` 里重复定义了一个本地 `interface Config`——同名不同义，没人管
3. 没有"契约层"的概念——类型没有统一归属

## 终点：两层 monorepo 的结构（本阶段目标）

```
opencode-from-scratch/
├── package.json          # 根：只声明 workspaces + 脚本转发
├── tsconfig.json
├── bunfig.toml
├── packages/
│   ├── schema/           # 契约层：共享类型（只依赖 effect，不依赖任何业务）
│   │   ├── package.json  # name: @opencode-from-scratch/schema
│   │   └── src/
│   │       ├── index.ts  # barrel 导出
│   │       └── types.ts  # 5 个共享类型（Effect Schema 重写）
│   └── opencode/         # 主应用：业务代码（从根 src/ 搬过来）
│       ├── package.json
│       ├── bunfig.toml
│       └── src/
│           ├── agent-loop.ts
│           ├── provider/
│           ├── tool/
│           └── ...
└── (src/ 已不存在——整体搬进 packages/opencode/src/)
```

## 迁移分几步走？

```
第 1 步：搭骨架（配置）
    root package.json 加 workspaces: ["packages/*"]
    tsconfig.json 加 paths 别名 + include packages
    → 建空的 packages/schema，能 typecheck

第 2 步：建 schema 契约层
    packages/schema/src/types.ts：5 个共享类型，用 Effect Schema 重写
    packages/schema/src/index.ts：barrel 导出
    → schema 包成立（叶子节点，只依赖 effect）

第 3 步：上层改用 schema 包
    9 个文件把 import { Message } from "./types" 改成 from "@opencode-from-scratch/schema"
    service/config.ts 删本地重复 Config，改用 schema 包的 ResolvedConfig
    删除 src/types.ts
    → typecheck 通过，功能不变

第 4 步：主应用搬进 packages/opencode（本阶段新增）
    git mv src/ packages/opencode/src/
    新建 packages/opencode/package.json
    root package.json 的 scripts 指向 packages/opencode
    tsconfig paths 的 @/* 指向 packages/opencode/src
    → 两层结构形成：packages/{schema, opencode}

第 5 步：修 bunfig preload（迁移踩到的坑）
    主应用搬走后，root 找不到 @opentui/solid
    bunfig.toml 的 preload 改成相对路径指向子包的 preload 文件
    → CLI 和 TUI 都能跑
```

## 每一步的验证标准

| 步骤 | 怎么确认成功了 |
|------|---------------|
| 第 1 步 | `bunx tsc --noEmit` 通过（空 schema 包 + 原 src 共存） |
| 第 2 步 | schema 包自身 typecheck 通过 |
| 第 3 步 | `bunx tsc --noEmit` 通过、CLI 跑通、功能不变 |
| 第 4 步 | `bunx tsc --noEmit` 通过、git 显示 33 个文件都是 rename 不是 delete+add |
| 第 5 步 | `bun run packages/opencode/src/index.ts` 能跑、TUI 能启动 |

## 一个重要的工程决策：为什么第 4 步现在做

最初设计只做 schema 包（第 1-3 步），主应用留在根 src/。但对照 opencode 的最终形态
（37 个 package，主应用在 `packages/opencode/`），**把 src/ 搬进 packages/opencode 只是
纯工程量**（搬文件 + 改路径），后面没有专门课程负责它，所以应该现在就做，
让结构一步到位对齐 opencode。

> 判断标准：如果拆分只是"搬文件、改路径"（不涉及概念重构），而且没有后续课程
> 专门做这件事，就趁现在做。真正的概念重构（core 服务化、Route 四轴等）留到
> 对应阶段（16、18、19）——那些有专门课程，且需要引入新概念。

## 对照 opencode

| 我们 | opencode |
|------|----------|
| `packages/schema` | `packages/schema`（@opencode-ai/schema，28 个 schema） |
| `packages/opencode` | `packages/opencode`（主应用，yargs CLI + agent） |
| root package.json | 根 workspaces |

opencode 的 `packages/opencode/package.json` name 就叫 `opencode`，我们的叫
`opencode-from-scratch`。结构对齐。

## 下一步

[15.1 第 1 步：配置 Bun workspaces + tsconfig paths](../01-setup/01-setup.md)
——动手搭 monorepo 骨架。
