# 14.3 阶段验收

## 验收清单

- [x] 能用 `Stream.fromIterable` / `fromAsyncIterable` 创建 Stream
- [x] 能用 `map` / `filter` / `tap` / `flatMap` 做逐元素变换和链式组合
- [x] 能用 `runForEach` 消费流（副作用）、`runFold` 聚合流
- [x] 理解 Stream 的惰性：创建 ≠ 执行，消费才产生值
- [x] `chatWithTools` 的 SSE 解析已改成 Stream 管线，对外接口不变
- [x] typecheck 通过、CLI + TUI 都能跑

## 验证方式

```bash
bun run typecheck               # 类型检查通过
bun run src/stream-demo.ts      # 14.1 基础演示（6 节输出）
bun run src/index.ts run "你好"  # CLI：用重构后的 provider 对话
bun run src/tui/agent.tsx       # TUI：流式输出逐字渲染
```

验证点：
1. **流式输出正常**：CLI/TUI 里回复逐字到达（说明 `onChunk` 由 `Stream.runForEach` 正确驱动）
2. **工具调用正常**：让 agent 用 read 工具读文件，tool_calls 的 arguments 分块拼接正确
3. **`--debug` 模式**：SSE 日志结构清晰（`SSE delta: content=...` / `tool_call 新建/追加`）

## 工程思维

**1. 把"遍历"从命令式变成声明式**

重构前：`for await` 手动循环，解码/拆行/过滤/解析混在一起。
重构后：一条 `.pipe(map, flatMap, filter, map, filter, map)` 链，每步只做一件事。
**核心变化是"遍历由谁驱动"**——从"我手动拉取"变成"Stream 框架驱动，我声明每一步"。

**2. 惰性是组合性的前提**

因为 Stream 是惰性的（创建不执行、消费才执行），我们才能安全地 `.pipe()` 组合——
组合发生在"描述"层面，执行发生在"消费"层面。如果创建即执行，第一步 `map` 就会
开始拉网络，根本无法先搭好整条管线再消费。

**3. 副作用放消费端，变换放管线里**

`map`/`filter` 是纯变换（不产生副作用）；`onChunk` 回调、累积 fullText/toolCalls
这些副作用留在 `runForEach` 的消费端。这个分工让管线可测试、可复用，
副作用集中在边界。这正是函数式编程的核心纪律。

**4. 为什么用 Stream 而不是继续用 ReadableStream**

ReadableStream 是 Web 标准（浏览器/Node 的字节流），能做基本的异步迭代，
但组合子少。Effect Stream 提供 `map/filter/tap/flatMap/runFold` 等丰富的组合子，
并且和 Service/Layer 体系（阶段 11）无缝衔接——同属 Effect 生态。
后续事件溯源（阶段 17）的本质就是"事件流"，用 Stream 表达最自然。

## 预告：Stream 是事件溯源的地基

opencode 的 session 用事件溯源：所有状态变化先写成事件（一个 Event 流），
再由投影器应用到数据库。这个"事件流"本质上就是一条 Stream——
阶段 17 会看到：`EventV2.publish` 发布事件 → `EventV2.subscribe` 订阅事件流 →
投影器消费事件流。理解了 Stream 的惰性、组合、消费，就理解了事件溯源的一半。

## 阶段产出

```
src/
├── stream-demo.ts        # 14.1 新增：Stream 基础演示
├── provider/
│   └── openai.ts         # 14.2 重构：SSE 解析改成 Stream 管线（接口不变）
```

对照 opencode：`opencode/packages/llm/src/route/framing.ts`（`Framing.sse` 把
"字节流 → 分帧"做成 Stream 变换）、`opencode/packages/llm/src/protocols/shared.ts`。
opencode 把 framing 从 protocol 拆成独立轴（Route 四轴之一），阶段 18 会讲。
