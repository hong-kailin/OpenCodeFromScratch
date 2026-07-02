# OpenCode From Scratch 启动文件

## 项目概述

本项目是一个**教学项目**：从零开始、一步一步重新实现 [opencode](https://opencode.ai)——一个开源 AI 编程 agent。源码参考位于 `./opencode/`（只读，不修改）。

> **参考版本**：opencode `v1.17.13`（commit `10c894bde`，分支 `dev`，仓库 https://github.com/anomalyco/opencode.git）。复刻以此版本为准，引用源码时如无特别说明均指该版本。

opencode 是一个大型 TypeScript monorepo（31 个 package），技术栈为 Bun + Effect-TS + Drizzle + opentui。它的核心是一个 **agent loop**：接收用户指令 → 组装上下文 → 调用 LLM → 执行工具调用 → 把结果喂回 LLM → 循环直到完成。

**我们的最终目标是 1:1 复刻 opencode 的完整代码。** 我们相信每一行代码都有它存在的意义，因此不会跳过或省略任何部分。但 opencode 是一个 31 个 package 的大型工程，一次性照搬无法理解其设计意图。所以我们的策略是：**从最简化的能跑版本起步，逐步演进到完整版**——每个阶段先实现一个"够用但简化"的版本让东西跑起来，理解它解决什么问题，再逐步补全到与 opencode 源码一致。遇到大量重复或样板代码时可以直接从源码复制，但复制前必须读懂它在做什么。最终产物是 opencode 的完整 1:1 复刻。

### 用户画像

- 算法工程师，Python 技术栈，计算机基础扎实（数据结构、算法、系统设计）
- **只会 Python**，对 TypeScript、Bun、Effect-TS、前端/终端 UI 开发完全不了解，这些都需要从零教起
- 学习动机：agent 太火了，想搞懂 AI coding agent 的内部原理
- 学习方式：读代码 + 理解设计决策，不是被布置作业

### 核心价值

> 读一万篇 agent 架构文章，不如亲手写一个。

---

## opencode 架构全景

理解我们要构建什么，先看真实的 opencode 是怎么组织的。

### Package 分层

```
依赖方向：上 → 下（下层不知道上层存在）

┌──────────────────────────────────────────────────────┐
│  packages/opencode   主应用（CLI 入口、session 编排、  │
│                      tool 实现、agent 定义、server）   │
├──────────────────────────────────────────────────────┤
│  packages/tui        终端 UI（opentui/solid）          │
│  packages/app        Web UI（SolidJS）                │
│  packages/desktop    桌面应用（Electron）              │
├──────────────────────────────────────────────────────┤
│  packages/server     HTTP 服务器（Hono），托管 API     │
│  packages/client     生成的客户端 SDK（Promise/Effect）│
│  packages/sdk-next   嵌入式 SDK（进程内托管）          │
├──────────────────────────────────────────────────────┤
│  packages/llm        LLM 抽象层（provider turn、流式、│
│                      tool dispatch、route/protocol）  │
├──────────────────────────────────────────────────────┤
│  packages/core       领域模型（session、project、      │
│                      provider、permission、database、  │
│                      filesystem）                      │
│  packages/protocol   HTTP API 定义（Effect HttpApi）   │
│  packages/schema     共享 Schema 叶节点                │
└──────────────────────────────────────────────────────┘
```

### 核心概念（对照真实源码）

| 概念 | 真实位置 | 说明 |
|------|----------|------|
| **Session** | `packages/opencode/src/session/` | 一次对话的完整生命周期，持久化历史 |
| **Provider Turn** | `packages/llm/` | 一次 LLM 请求 + 响应，是 agent loop 的最小单位 |
| **Tool Loop** | `session/prompt.ts` | LLM 返回工具调用 → 执行 → 结果喂回 → 继续调用，直到 LLM 不再调用工具 |
| **Tool** | `packages/opencode/src/tool/` | read、write、edit、bash、grep、glob、task、todo、webfetch 等 |
| **System Context** | `core/src/system-context/` | 组装给 LLM 的初始指令（AGENTS.md、日期、环境等） |
| **Route** | `llm/src/route/` | protocol + endpoint + auth + framing 四轴组合，一个 provider 的一种 API |
| **Agent** | `packages/opencode/src/agent/` | build（全权限）、plan（只读）、general（子 agent） |
| **Permission** | `packages/opencode/src/permission/` | 工具执行前的权限检查 |

### Agent Loop 简化流程

```
用户输入 prompt
    │
    ▼
组装 System Context（AGENTS.md + 日期 + 环境信息）
    │
    ▼
┌─→ 构建 messages（历史 + 当前 prompt）
│       │
│       ▼
│   调用 LLM（一次 Provider Turn，流式返回）
│       │
│       ▼
│   LLM 返回内容：文本 / 工具调用 / 结束
│       │
│   ┌───┴───┐
│   │工具调用?│──是──→ 执行工具 → 结果加入 messages ──┐
│   └───┬───┘                                       │
│       │ 否                                        │
│       ▼                                           │
│   输出文本，循环结束                                 │
│                                                   │
└───────────────────────────────────────────────────┘
```

---

## 技术栈

| 技术 | 作用 | 对应 Python 概念 |
|------|------|------------------|
| **Bun** | JS 运行时 + 包管理器 | Python 解释器 + pip/uv |
| **TypeScript** | 编程语言 | 带类型标注的 Python（但更严格） |
| **Effect-TS** | 函数式框架（Service/Layer/Stream/Schema） | 无直接对应；类似"带依赖注入的 async + Result 类型" |
| **Drizzle ORM** | SQLite ORM | SQLAlchemy |
| **yargs** | CLI 参数解析 | argparse / click |
| **opentui/solid** | 终端 UI 框架 | 无直接对应；类似 React 但渲染在终端 |

> Effect-TS 是 opencode 的灵魂，也是最陡的学习曲线。我们会渐进式引入：先用裸 async/await，等感受到"服务依赖到处传"的痛点时再引入 Effect。

---

## 学习路线图

详细的课程内容见 [COURSE.md](./COURSE.md)。核心原则：**每个阶段产出一个能跑的东西**。从阶段 0（TypeScript + Bun 起步）到阶段 10（高级特性），共 11 个阶段，每个阶段先实现简化版，再逐步补全到与 opencode 源码一致。

> **注意**：COURSE.md 是活文档。进入每个阶段前细化具体课程内容，不提前规划过细。

---

## 开发约定

### 代码风格

学习 opencode 的真实约定，但根据学习阶段渐进采用：

- **变量**：const 优先，用三元表达式或 early return 代替 let + if/else
- **控制流**：避免 else，优先 early return
- **函数式**：优先 map / filter / flatMap 而非 for 循环
- **导入**：不别名导入（不写 import { foo as bar }）；不用 import * as
- **注释**：项目代码注释解释"为什么"而非"做什么"；教学代码注释可以解释"在做什么"（详见下方教学代码约定）
- **Schema 字段**：snake_case（与 opencode 的 Drizzle 约定一致）

### Git 规范

- Conventional Commits：feat: / fix: / docs: / refactor: / test:
- **commit message 用中文**（type 前缀保留英文，描述用中文，如 `docs: 添加项目启动文件`）
- **不要自动提交 commit**：完成工作后告知用户，等用户确认后再提交，不要自己执行 git commit
- 每个阶段完成后打 tag：v0.1.0、v0.2.0 ...
- 分支：main 保持稳定，每个阶段独立分支开发
- 分支名：最多三个词，连字符分隔，如 tool-loop、session-persist

### 文件组织

- **项目代码**：采用与 opencode 一致的 monorepo 结构，代码写在 `packages/<package-name>/src/` 下（最终复刻 opencode 的 31 个 package 分层）。但渐进式起步——前期阶段先在一个 package 内推进，等某层抽象真正需要拆分时再按 opencode 的分层拆出独立 package
- **课程文档**：每个阶段在 `docs/` 下创建编号文件夹（如 `docs/01-minimal-agent/`），阶段内每节小课再创建子文件夹（如 `docs/01-minimal-agent/01-config-file/`），小课文件夹内放带序号的 `.md` 文件（如 `01-config-file.md`）
- **源码参考**：opencode/ 目录只读，不修改，用于对照学习

### 文档拆分

> 原则：**一个文件只讲一件事。** 内容堆在一起会让人望而生畏，拆开读才轻松。

- 每节小课有独立子文件夹（如 `docs/01-minimal-agent/01-config-file/`），文件夹内放该课的 `.md` 文件
- 一节课只讲一个知识点时，文件夹内用一个 `.md` 文件承载正文
- 一节课涉及多个概念时，拆成多个带序号的 `.md` 文件（如 `01-messages.md`、`02-curl-demo.md`），各自聚焦一个知识点
- 判断拆分时机：一个 `.md` 超过约 150 行，或出现明显话题切换时就拆

### 教学代码

> 原则：**不布置作业，把代码讲透。** 通过读懂代码学习，而不是被要求自己写。

- **不设置动手作业**：课程文档不要出现"动手做：完成一个 XX 任务"这类需要用户从零写代码的环节。用户的时间花在「读懂」上，不是「被考」上
- **代码即教材**：文档里出现的每一段代码，都要有对应的、可直接打开阅读的代码文件，让用户能进代码里学习，而不是只看文档里的代码片段
- **代码配文档**：每份教学代码配套一份说明文档，讲清这份代码解决什么问题、关键设计点、怎么跑起来
- **详细注释**：教学代码要有详细注释。和项目代码"注释解释 why 不解释 what"不同，教学代码的注释可以也应当解释「这段代码在做什么」「为什么这样写」，因为目的是让从零学的用户看懂。修改代码时必须同步更新注释，不允许注释与代码不匹配
- **教 Debug**：用户只会 Python，对 TypeScript/Effect/Bun 的调试方式完全不了解。课程要教具体的 debug 手法：`console.log` / `Bun.debugger` 断点调试、报错信息怎么读、effect 调用链怎么追踪、运行时类型不符怎么排查。不能只给"正确答案"代码，要演示"代码跑不通时怎么定位问题"

### 概念引入节奏

> 原则：**用到再讲，讲到再展开。** 不要提前透支后续课程的概念。

- **不提前引入**：课程文档不要提前介绍后续课程才讲到的概念。即使当前代码里不得不出现它，也只用一句话标注"后续 XX 课会讲"，不展开解释
- **在需要时才引入**：一个概念应当在它被真正需要、能回答一个具体问题时才引入，而不是"顺便提一下"
- **先动手后概念**：一节课的内部顺序，优先「先做、再回头看为什么」。概念没有实操打底就是空的——先让读者看到屏幕上发生了什么，再解释背后的名词和原理
- **避免前向依赖**：写当前课程时，不要假设读者已经懂后续课程的内容；只能假设读者懂前面课程已讲过的东西

---

## 给 AI 助手的指令

当你在本项目的新 session 中工作时，请遵循以下原则：

1. **奥卡姆剃刀原则**：如无必要，勿增实体。能用简单方案解决的，不要引入额外的抽象、库或复杂度。先问"这个真的需要吗？"，而不是"这样做更优雅"。但记住最终目标是 1:1 复刻，简化只是过渡手段，不是终点
2. **教工程思维，不教基础概念**：用户是算法工程师，计算机基础扎实。重点是设计决策、架构思路、trade-off 分析，不是"什么是变量"。同时要覆盖 TypeScript/Bun/Effect 等技术栈的从零教学。**用户只会 Python，TypeScript、Effect-TS、Bun 等都需要从零教起**
3. **渐进式复杂度**：从最简单的实现开始，逐步引入抽象和优化。让用户看到"为什么需要这个抽象"的动机，而不是直接给最终方案。例如：先用裸 fetch 调 API，等感受到重复代码的痛点再抽象 Provider。但每个简化版最终都要补全到与 opencode 源码一致
4. **关联已有知识**：解释新概念时，尽量关联用户已有的 Python 和算法背景。比如用"Python 的 type hints"类比"TypeScript 类型标注"，用"asyncio"类比"Effect 的 fiber"，用"dataclass"类比"Schema.Struct"
5. **先问后做**：遇到设计决策时，给出选项和各自的 trade-off，让用户选择。这是培养工程判断力的关键
6. **对照真实源码**：每个阶段实现简化版后，带用户看 opencode 对应的真实源码（`./opencode/` 目录），理解真实版为什么更复杂，再逐步把简化版补全到与源码一致。引用真实源码时使用 `opencode/packages/...` 路径
7. **阶段验收**：每个阶段完成后，帮用户总结"这个阶段你学到了什么工程思维"，而不是"你学了哪些 API"
8. **代码是思维的载体**：每段代码都应该能回答"为什么这样写"。如果一段代码只是"教程里这么写的"，那就需要解释背后的原因
9. **中文为主，术语保留英文**：解释用中文，技术术语保留英文（如 Provider Turn、Effect Stream、tool loop、trade-off）

---

## 当前状态

见 [COURSE.md](./COURSE.md) 的"当前状态"部分。

> **下一步**：从阶段 0 开始。进入前先细化 COURSE.md 中阶段 0 的具体课程内容。
