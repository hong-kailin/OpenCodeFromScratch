# 15.6 阶段验收

## 迁移回顾：一张图看完整个阶段 15

```
阶段 14 结束时的单 package
┌──────────────────────────────────────────────┐
│ opencode-from-scratch/                        │
│ ├── package.json                             │
│ ├── tsconfig.json                            │
│ ├── bunfig.toml                              │
│ └── src/         (类型+业务+工具+UI 混在一起)   │
│     ├── types.ts                             │
│     ├── agent-loop.ts                        │
│     └── ...                                  │
└──────────────────────────────────────────────┘
                    │
        ┌───────────┼───────────────┐
        ▼           ▼               ▼
     第1步        第2步           第3步
   搭骨架       建 schema 包     搬主应用
  (workspaces  (5类型Schema    (git mv src
   +paths)      重写)           →packages/
                                opencode)
                    │
        ┌───────────┼───────────────┐
        ▼                           ▼
     第4步                       第5步
   上层换导入                   修 preload 坑
  (9文件改from              (root 找不到
   @opencode-...)           @opentui/solid)
                    │
                    ▼
阶段 15 结束的两层 monorepo
┌──────────────────────────────────────────────┐
│ opencode-from-scratch/                        │
│ ├── package.json    (workspaces + 脚本转发)   │
│ ├── tsconfig.json                            │
│ ├── bunfig.toml     (preload 相对路径)        │
│ └── packages/                                 │
│     ├── schema/     契约层 (只依赖 effect)     │
│     │   └── src/  types.ts + index.ts         │
│     └── opencode/   主应用 (业务代码)          │
│         ├── package.json                     │
│         └── src/  agent-loop.ts ...          │
└──────────────────────────────────────────────┘
```

## 验收清单

- [x] 理解 monorepo：一个仓库多个 package，职责单一、依赖清晰
- [x] 理解契约层：schema 包定义共享类型，是依赖树叶子（只依赖 effect）
- [x] 配置 Bun workspaces（root `package.json` 的 `workspaces`）+ tsconfig paths
- [x] 5 个共享类型搬进 schema 包，用 Effect Schema 重写（双重身份）
- [x] 9 个文件导入改为 `@opencode-from-scratch/schema`，config.ts 消除重复定义
- [x] 主应用 `src/` 搬进 `packages/opencode/`（git mv 保留历史）
- [x] 修 bunfig preload（相对路径指向子包）
- [x] typecheck 通过、CLI 跑通、功能不变

## 验证方式

```bash
bunx tsc --noEmit                                 # 类型检查（schema + opencode 全通过）
git status                                        # 33 个文件显示 R（rename）不是 D+A
bun run packages/opencode/src/index.ts run "你好"   # CLI 跑通
bun run packages/opencode/src/tui/hello.tsx       # TUI 能启动
```

验证点：
1. `tsc --noEmit` 通过——schema 包 + opencode 包全项目类型无误
2. `git status` 显示 rename——git mv 保留了历史
3. CLI/TUI 跑通——preload 修复有效，功能未破坏

## 工程思维

**1. 契约层 = 定义"世界长什么样"的地方**

Schema 包不包含任何业务逻辑，只描述类型。它回答了"Message 长什么样？ToolCall 长什么样？"。
上层所有包只依赖它，它是整棵依赖树的叶子。这是整个 monorepo 分层的地基——
阶段 16 的 core、阶段 19 的 server/client 都会从 schema 包取类型。

**2. 依赖方向：上 → 下，下层不知道上层存在**

```
packages/opencode（业务）→ packages/schema（契约）
```

schema 包不知道有 opencode 的存在，opencode 知道有 schema。这个单向依赖让代码
可维护：改 schema 包，所有上层跟着受益；改上层，schema 包不受影响。

**3. 拆包判断标准**

什么时候拆包、什么时候留到以后？核心标准：
- **纯工程量**（搬文件、改路径）+ 没有后续课程负责 → 现在拆（本次的 opencode 包）
- **概念重构**（引入新抽象，如服务化、Route 四轴）→ 留到专门阶段（16、18、19）

**4. 迁移最容易坏的往往是"隐式配置"**

拆包不只是搬代码——依赖位置变了，preload、bunfig、env 这类隐式配置会悄悄坏掉。
这次踩的 preload 坑就是典型。迁移后一定要跑一遍所有入口（CLI、TUI），
而不是只看 typecheck。

**5. 一次"重复定义"的实战教训**

`service/config.ts` 里那个本地 `interface Config` 和 `src/types.ts` 的 `Config`
**同名但含义不同**——搬进契约层后被迫改名 `ResolvedConfig`。monorepo 拆分的价值
之一就是：**迫使你面对命名冲突，把隐含的边界显式化**。

## 阶段产出

```
opencode-from-scratch/
├── package.json                 # workspaces: ["packages/*"] + 脚本转发
├── tsconfig.json                # paths: @/* → packages/opencode/src, schema 包
├── bunfig.toml                  # preload 相对路径指向子包
├── packages/
│   ├── schema/                  # 契约层（新增）
│   │   ├── package.json         # name: @opencode-from-scratch/schema
│   │   └── src/
│   │       ├── index.ts         # barrel 导出
│   │       └── types.ts         # 5 个共享类型（Effect Schema 重写）
│   └── opencode/                # 主应用（新增，src/ 搬入）
│       ├── package.json         # name: opencode-from-scratch
│       └── src/                 # 33 个文件（git rename）
└── (src/ 已不存在)
```

对照 opencode：`packages/schema/`（28 个 schema）+ `packages/opencode/`（主应用）。

## 下一步

阶段 16：Core 领域服务化——把 session/provider/tool/database 等领域逻辑重构成
Effect Service，搬进新建的 `core` 包。三层结构：`packages/{schema, core, opencode}`。
