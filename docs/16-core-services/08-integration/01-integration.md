# 16.8 上层接入 + 验收：阶段 16 收官

> 阶段 16 的地图见 [16.0 总览](../00-overview/01-overview.md)。
> 本课是最后一课：全盘检查 CLI/TUI 是否都走服务、确认没有兼容层残留、
> 完整验收功能与阶段 15 一致，并总结这个阶段学到的工程思维。

## 这一步做什么

7 个服务已经全部服务化（16.2~16.7），入口也逐个接上了。最后做三件事：

1. **删光兼容层**——检查所有"过渡桥接"是否已移除
2. **全量回归**——demo + CLI 各模式 + TUI 全跑一遍
3. **对照验收**——确认"功能与阶段 15 一致，但架构升了一级"

## 检查 1：无兼容层残留

阶段 16 过程**留过两个过渡方案**，逐一确认已删除：

| 过渡方案 | 出现 | 何时删除 | 状态 |
|---------|------|---------|------|
| `database.ts` 末尾的模块级 `db` 导出 | 16.2 | 16.6（SessionStore 就位） | ✅ 已删 |
| `buildSystemPrompt()` 模块级函数 | 阶段 7 | 16.7（SystemContext 就位） | ✅ 已删 |

用 grep 确认没有代码再引用旧 API（注释里提到不算）：

```bash
rg -n "buildSystemPrompt|createSession|listSessions|saveMessage|import \{ db \}" packages/
# 期望：只有注释里的历史说明，没有实际代码引用
```

> **工程要点**：过渡代码必须"用完即删"。桥接存在的唯一理由是让旧代码在
> 重构期间不破，新结构就位后它就成了技术债。阶段 16 里桥接活了 4 个步骤
> （16.2→16.6），期间每步都标注了"何时删"——这是渐进式重构的关键纪律。

## 检查 2：全量回归

```bash
# 1. 类型检查
bunx tsc --noEmit

# 2. 三个教学 demo
bun run packages/core/src/database/database-demo.ts   # "Database Service 工作正常"
bun run packages/core/src/filesystem-demo.ts          # glob/read 输出 + mock 替换
bun run packages/opencode/src/stream-demo.ts          # 阶段 14 的 Stream 教学 demo

# 3. CLI 各模式
bun run packages/opencode/src/index.ts run "2+2=?"          # 非交互：AI 回答
bun run packages/opencode/src/index.ts run -c "回顾上轮"    # 恢复：记住上下文
bun run packages/opencode/src/index.ts run -d "1+1=?"       # debug：打印 API 请求

# 4. TUI
bun run packages/opencode/src/tui/hello.tsx          # 启动 3 秒无报错即正常
```

## 最终结构：三层 monorepo

```
packages/
├── schema/           # 契约层（阶段 15）：5 个共享类型
├── core/             # 领域层（本阶段）：7 个 Effect Service
│   └── src/
│       ├── config/          ConfigService（阶段 11）
│       ├── provider/        ProviderService（阶段 11）+ OpenAI/Anthropic 实现
│       ├── tool/            ToolRegistry + 6 个工具（各自注册）
│       ├── database/        Database 服务 + sql.ts 表结构
│       ├── session/         SessionStore 服务
│       ├── system-context.ts SystemContext 服务
│       ├── error/           Typed Errors
│       └── debug.ts         调试工具
└── opencode/         # 入口层：agent-loop + CLI + TUI
    └── src/
        ├── agent-loop.ts     # 从 Context 取 4 个服务跑循环
        ├── index.ts          # CLI（yield* SessionStore / SystemContext）
        └── tui/agent.tsx     # TUI（yield* SystemContext）
```

## 对照 opencode

| 我们 | opencode |
|------|----------|
| `core/` 7 个服务 | `packages/core` 50+ 文件的领域层 |
| 简化版服务边界 | 每个领域一个 Effect Service，思路一致 |
| 入口层只管编排 | `packages/opencode` 只做 CLI/agent 编排 |
| 无兼容层（干净收官） | 生产代码同样不允许临时桥接滞留 |

## 工程思维总结：这个阶段你学到了什么

阶段 16 的核心不是"多用几个 Service"，而是**服务化背后的判断力**：

1. **先搬移、后服务化**——纯工程量（git mv）和概念重构（服务化）拆开做。
   报错时能分清是"搬错了"还是"设计错了"。

2. **每步一个可验证的增量**——16.1~16.7 每步都有 `tsc` + 一个 demo/回归。
   从不一次性改 5 个文件再赌它能跑。

3. **副作用收进 Layer**——`import 即建库` → `provide 时才建库`。
   "什么时候触发副作用"从被动变成主动，这是可测试性的前提。

4. **过渡方案必须标注生命周期**——16.2 的桥接活了 4 步，但每步都知道
   "16.6 删"。过渡代码不可怕，可怕的是它"永远过渡"。

5. **依赖写进类型**（R 泛型）——"执行 read 需要 FileSystem 服务"由编译器
   强制，而不是靠程序员记得。类型系统是免费的文档。

6. **去中心化优于集中**（ToolRegistry）——集中列表让"注册表"变成"工具大全"，
   去中心化让加工具只改一处。判断标准：**改动会不会触碰无关代码**。

## 下一步

阶段 16 收官。对照 [16.0 总览](../00-overview/01-overview.md) 里的路线图，
接下来进入 [阶段 17：LLM Route 四轴模型](../../17-llm-route/00-problem-and-model/01-current-problem.md)，
从当前 Provider 的职责耦合出发，先理解 Protocol、Endpoint、Auth、Framing 为什么需要分开。
SessionStore 的事件溯源改造顺延到阶段 18；当前阶段继续复用直接 CRUD。
