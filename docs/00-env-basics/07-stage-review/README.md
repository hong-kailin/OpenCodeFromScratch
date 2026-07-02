# 0.7 阶段验收：跑起来 + 工程思维总结

> 本课目标：验收阶段 0 的成果，总结学到的工程思维，对照 opencode 真实入口看差距。

## 验收清单

跑一遍这些命令，全部通过说明阶段 0 完成：

```bash
# 1. Bun 运行正常
bun --version

# 2. 程序能跑
bun run dev
# 期望输出：hello opencode

# 3. 类型检查通过
bun run typecheck
# 期望输出：无（静默成功）

# 4. 模块导入正常
bun run src/module-demo.ts
# 期望输出：add(10, 20): 30 等

# 5. VSCode 断点调试
# 打开 src/debug-target.ts → 设断点 → F5 → 程序暂停在断点
```

| 验收项 | 状态 |
|--------|------|
| Bun 安装、`.ts` 直接运行 | ✓ |
| TypeScript 类型标注（对照 Python type hints） | ✓ |
| import/export 模块系统 | ✓ |
| package.json 配置 + bun install | ✓ |
| tsconfig.json 配置 + typecheck | ✓ |
| VSCode 断点调试 | ✓ |

## 项目结构

阶段 0 结束后，我们的项目长这样：

```
opencode-from-scratch/
├── .gitignore               # 忽略 node_modules 等
├── .vscode/
│   └── launch.json          # VSCode 调试配置
├── package.json             # 项目配置（依赖、scripts）
├── tsconfig.json            # TS 编译配置
├── bun.lock                 # 依赖锁文件
└── src/
    ├── index.ts             # 入口：console.log("hello opencode")
    ├── math-utils.ts        # 模块导出演示
    ├── module-demo.ts       # 模块导入演示
    ├── type-demo.ts         # 类型系统演示
    ├── error-demo.ts        # 运行时报错演示
    ├── type-error-demo.ts   # 类型报错演示
    ├── debug-demo.ts        # console.log 打点演示
    └── debug-target.ts      # 断点调试目标
```

## 对照 opencode 真实入口

我们的 `src/index.ts`：

```ts
console.log("hello opencode")
```

opencode 的入口 [`opencode/packages/opencode/src/index.ts`](../../../opencode/packages/opencode/src/index.ts)：

```ts
import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import { RunCommand } from "./cli/cmd/run"
import { GenerateCommand } from "./cli/cmd/generate"
// ... 20 多个 import

const cli = yargs(args)
  .scriptName("opencode")
  .command(RunCommand)
  .command(GenerateCommand)
  // ... 注册各种子命令
```

差距很大，但能看出方向：

| | 我们的 index.ts | opencode 的 index.ts |
|---|-----------------|----------------------|
| 做什么 | 打印一句话 | 解析命令行参数，分发到子命令 |
| 用到的知识 | console.log | import、第三方包（yargs）、CLI 框架 |
| 对应阶段 | 阶段 0 | 阶段 8（CLI 入口） |

opencode 用 `yargs` 做命令行解析（类比 Python 的 `argparse`/`click`），注册了 `run`、`serve`、`debug` 等子命令。这些我们会在阶段 8（CLI 入口）实现。

## 工程思维总结

阶段 0 你学到的不只是语法，更是一些工程思维：

### 1. 运行时和类型检查是分开的

Python 里你习惯了 `python script.py` 既能跑也能报类型错误（运行时）。但 TS 世界里：

- **Bun**（运行时）：执行代码，不管类型标注
- **tsc**（类型检查器）：扫描代码找类型错误，不执行代码

这就是为什么需要两套配置（package.json 给 Bun，tsconfig.json 给 tsc）、两个命令（`bun run dev` 运行，`bun run typecheck` 检查）。

> 工程思维：**关注点分离**。运行和检查是两个不同的关注点，用不同工具处理。Python 把它们混在一起（运行时也能抛 TypeError），TS 把它们拆开了。

### 2. 配置文件是"项目的契约"

package.json 和 tsconfig.json 不只是配置——它们是**项目的契约**：

- package.json 声明"这个项目依赖什么、怎么跑"
- tsconfig.json 声明"这个项目用什么 TS 规则"
- bun.lock 锁定"每个人装的依赖版本完全一致"

新人 clone 项目后，`bun install` + `bun run dev` 就能跑起来，不用问任何人。这就是配置文件的价值。

> 工程思维：**让项目自描述**。好的项目不需要 README 写一堆"先装这个再装那个"，配置文件本身就是说明。

### 3. 先跑通再完善

我们的 index.ts 只有一行 `console.log`，但它验证了整条工具链通了：Bun 能跑、TS 能检查、VSCode 能调试。后续阶段往里加 LLM 调用、工具系统、session 管理时，基础是可靠的。

> 工程思维：**先建立可工作的最小闭环，再逐步加功能**。不要一上来就写复杂代码，先确保"写代码 → 运行 → 调试"这条路通。

## 阶段 0 学了什么

| 课 | 知识点 | Python 类比 |
|----|--------|-------------|
| 0.1 | Bun 运行时 + console.log + 读报错 | python + print + traceback |
| 0.2 | TypeScript 类型系统初步 | type hints |
| 0.3 | import/export 模块系统 | import |
| 0.4 | package.json + 依赖管理 | pyproject.toml + pip |
| 0.5 | tsconfig.json + 类型检查 | mypy.ini + mypy |
| 0.6 | VSCode 断点调试 | pdb / PyCharm 调试器 |

你现在是"能写 TS、能跑、能调试"的状态。下一步要开始真正构建 agent 了。

---

下一步：[阶段 1：最小 Agent](../../01-minimal-agent/) —— 用 fetch 直接调 LLM API。
