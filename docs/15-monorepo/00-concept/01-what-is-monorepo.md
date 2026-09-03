# 15.0.1 什么是 Monorepo（概念入门）

> 本课先搞清楚"monorepo"到底是个什么东西、为什么工程界要这么组织代码，
> 再看我们项目怎么落地。概念不搞懂，后面的操作都是"照抄步骤"。

## 一个类比先建立直觉

想象你做一个大项目，代码越来越多，你怎么组织它？两个极端：

**方案 A：一个仓库，一个包（mono- + repo）**
```
my-project/
├── package.json       # 一个 package
└── src/               # 所有代码
    ├── ui/            # 界面
    ├── core/          # 核心逻辑
    └── utils/         # 工具函数
```

**方案 B：一个仓库，多个包（monorepo）**
```
my-project/
├── package.json       # 根：只管"有哪些包"
└── packages/
    ├── ui/            # 独立 package（自己的 package.json、自己的依赖）
    │   └── package.json
    ├── core/          # 独立 package
    │   └── package.json
    └── utils/         # 独立 package
        └── package.json
```

**monorepo 就是方案 B**：一个代码仓库（mono = 一个，repo = repository），
里面放多个独立 package。每个 package 有自己的 `package.json`（自己的名字、依赖、脚本），
但都住在同一个仓库里。

## Python 对照

Python 没有"monorepo"这个专有名词，但思想你早就见过：

| 概念 | Python | TS/Bun |
|------|--------|--------|
| 一个"包"（独立单元） | 一个 Python 包 / 模块 | 一个 package（有自己的 package.json） |
| 多包放一个仓库 | 一个大仓库里多个 `src/xxx` 目录 | monorepo 的 `packages/xxx` |
| 包间依赖 | `pip install -e ./pkg_a` 本地安装 | `workspace:*` 链接到本仓库的包 |
| 依赖清单 | `pyproject.toml` | `package.json` |

你熟悉的场景：一个 GitHub 仓库里同时有 `backend/`、`frontend/`、`ml/` 几个项目，
它们共用 git 历史但各自独立。monorepo 就是这个思路的"正规军"版本——每个目录
不是随便分的文件夹，而是**有独立 package.json 的正式包**。

## 为什么叫"mono"？——对比 polyrepo

工程界还有另一种组织方式：**polyrepo**（多个仓库，每包一个仓库）。

```
polyrepo:                            monorepo:
github.com/org/ui   （独立仓库）       github.com/org/my-project
github.com/org/core （独立仓库）       └── packages/
github.com/org/utils（独立仓库）           ├── ui/
                                          ├── core/
                                          └── utils/
```

对比：

| | polyrepo（多仓库） | monorepo（单仓库多包） |
|---|---|---|
| 改一个跨包的改动 | 要开多个 PR、多个仓库 | 一个 PR 搞定 |
| 包间联调 | 发布/安装麻烦（版本地狱） | `workspace:*` 直接本地链接 |
| 依赖升级 | 每个仓库各升各的 | 一处改，全部同步 |
| 代码共享 | 要发 npm 包 | 直接链接，不用发布 |
| 权限/规模 | 可精细控制 | 一个仓库可能很大 |

opencode 用 monorepo——因为它有 37 个 package 要紧密协作，多仓库管理成本太高。

## monorepo 的关键机制：workspaces

光把目录分成 `packages/xxx` 还不够，要让工具（Bun）认识"这是一个 monorepo"，
需要 **workspaces** 机制。

```
root package.json
    "workspaces": ["packages/*"]
        │
        ▼
Bun 会：
1. 扫描 packages/ 下每个有 package.json 的目录
2. 把它们都当作"本仓库的包"
3. 包间引用用 workspace:* 直接链接（不下载，用本地的）
4. 依赖装到各自的 node_modules
```

类比 Python：workspaces 有点像 `pip install -e`（本地开发安装）——
包 A 依赖包 B，不是从 PyPI 下载 B，而是直接用本仓库里的 B。

## monorepo 的依赖方向：分层

monorepo 里的包不是平级的，而是**有依赖方向的**。opencode 的分层：

```
┌─────────────────────────────────────┐
│  packages/opencode   主应用         │  ← 最上层：聚合所有包
├─────────────────────────────────────┤
│  packages/llm        LLM 抽象       │
├─────────────────────────────────────┤
│  packages/core       领域逻辑       │
├─────────────────────────────────────┤
│  packages/schema     契约（类型）    │  ← 最底层：只定义"世界长什么样"
└─────────────────────────────────────┘
依赖方向：上 → 下（下层不知道上层存在）
```

关键规则：**下层不知道上层存在**。
- schema 包不知道有 core、opencode
- core 知道有 schema（依赖它）
- opencode 知道有 core、schema

这个单向依赖是 monorepo 的核心纪律——它保证了代码可维护：改底层，
所有上层受益；改上层，底层不受影响。

## 回到我们的项目

阶段 14 结束时我们其实是**方案 A**（一个 package）：
```
opencode-from-scratch/
├── package.json       # 唯一的 package
└── src/               # 类型、业务、工具、UI 全混一起
```

阶段 15 要把它变成 monorepo（方案 B），但**不是一步到位拆 37 个包**——
按 AGENTS.md 的渐进式原则，先拆出最有价值的：

```
opencode-from-scratch/
├── package.json          # 根：workspaces + 脚本转发
└── packages/
    ├── schema/           # 契约层：共享类型（本阶段拆）
    └── opencode/         # 主应用：业务代码（本阶段拆）
```

后续阶段 16/18/19 会继续拆 core、llm、protocol/server，最终对齐 opencode 的完整分层。

## 小结

1. **monorepo** = 一个仓库放多个独立 package（对比 polyrepo：多个仓库）
2. **package** = 有独立 package.json 的包（自己的名字、依赖、脚本）
3. **workspaces** = 让工具认识多包结构的机制（`workspaces: ["packages/*"]`）
4. **依赖方向** = 上 → 下，下层不知道上层存在（分层纪律）
5. 我们阶段 15 从"单包"迁到"两层 monorepo"（schema + opencode）

## 下一步

[15.0.2 迁移总览](../01-overview/01-overview.md) —— 看清从单包到 monorepo 分几步走。
