# 8.2 yargs 中间件：全局前置处理

> 本课目标：理解 yargs middleware 的作用和执行时机，实现 `--debug` 全局选项。

## 什么是中间件

中间件（middleware）是在**命令 handler 之前**运行的函数。它可以：
- 修改 args 对象（给 handler 传额外信息）
- 设置全局状态（环境变量、全局变量）
- 做跨命令的通用处理（日志、配置加载等）

> Python 类比：Flask 的 `@app.before_request`——每个请求处理前先跑一段代码。yargs middleware 一样，每个命令 handler 前先跑。

## 为什么需要中间件

假设你有 3 个命令（run、serve、session list），每个都需要：
- 读取 `--debug` 选项决定是否打印调试日志
- 设置 `AGENT=1` 环境变量让深层代码知道自己在 agent 里运行

不用中间件，你得在每个 handler 里重复写：

```ts
// run 命令的 handler
async (args) => {
  if (args.debug) process.env.DEBUG = "1"  // 重复
  process.env.AGENT = "1"                   // 重复
  // ... 实际逻辑
}

// serve 命令的 handler
async (args) => {
  if (args.debug) process.env.DEBUG = "1"  // 重复
  process.env.AGENT = "1"                   // 重复
  // ... 实际逻辑
}
```

用中间件，写一次就够了：

```ts
.middleware(async (args) => {
  if (args.debug) process.env.DEBUG = "1"
  process.env.AGENT = "1"
})
```

所有命令的 handler 执行前，yargs 自动先跑这个中间件。handler 里不用管这些通用逻辑，只管自己的事。

> **工程思维**：中间件解决的是"横切关注点"（cross-cutting concerns）——多个地方都需要、但不属于任何单个命令核心逻辑的功能。日志、认证、配置加载都是典型的横切关注点。

## 执行顺序

yargs 的执行顺序：

```
用户输入: bun run src/index.ts run "你好" --debug
    │
    ▼
1. yargs 读取参数: ["run", "你好", "--debug"]
    │
    ▼
2. 匹配命令: 找到 "run" 命令
    │
    ▼
3. 调用 builder: 声明 run 命令的参数（message, --continue, --session）
    │
    ▼
4. 解析参数: 按声明解析 → { message: ["你好"], debug: true, continue: false, ... }
    │
    ▼
5. 调用 middleware: 设置 process.env.DEBUG = "1", process.env.AGENT = "1"
    │
    ▼
6. 调用 handler: 用解析好的 args 执行业务逻辑
```

关键：**builder → 解析 → middleware → handler**。middleware 在参数解析完之后、handler 之前运行，所以 middleware 能拿到完整的 `args` 对象。

> 对比 builder 和 middleware 的职责：
> - **builder**：声明"有哪些参数"（声明式）
> - **middleware**：用解析好的参数做"前置处理"（命令式）
> - **handler**：执行核心逻辑（命令式）

## 实现：--debug 全局选项

我们加一个 `--debug` 全局选项，通过 middleware 设置 `process.env.DEBUG`。

### 定义全局选项 + middleware

```ts
yargs(hideBin(process.argv))
  .scriptName("opencode-from-scratch")
  // 全局选项：所有命令都能用 --debug
  .option("debug", {
    alias: "d",
    type: "boolean",
    description: "启用调试日志",
    global: true,  // ← 关键：设为全局，所有命令都能用
  })
  // 中间件：在 handler 之前运行
  .middleware(async (args) => {
    // 把 yargs 选项转成环境变量
    // 深层代码（llm.ts、tool/*.ts）不用传参，直接读 process.env.DEBUG
    if (args.debug) {
      process.env.DEBUG = "1"
    }
    process.env.AGENT = "1"
  })
  .command("run [message..]", ...)
  .parse()
```

### 为什么用环境变量而不是直接传参

深层代码（比如 `src/provider/openai.ts` 里的 fetch）可能需要知道是否处于调试模式。如果不用环境变量，你得把 `debug` 参数层层传递：

```
index.ts → provider → openai.ts → fetch 里打印请求体
```

每层都要加 `debug` 参数，很烦。用环境变量，深层代码直接 `process.env.DEBUG` 就能读到，不用传参。

> 对照 opencode：它的 middleware 就是这么做的——把 `--print-logs`、`--log-level` 转成 `process.env.OPENCODE_PRINT_LOGS`、`process.env.OPENCODE_LOG_LEVEL`。深层 Effect 代码直接读环境变量，不用层层传参。

### `global: true` 的作用

yargs 的选项默认只对当前命令有效。`global: true` 让选项对所有命令都有效——不管你定义在哪个位置，所有命令的 handler 都能收到这个参数。

```ts
// 不加 global: true
.option("debug", { type: "boolean" })
// 只有定义它的命令能用 --debug

// 加 global: true
.option("debug", { type: "boolean", global: true })
// 所有命令都能用 --debug
```

我们目前只有 `run` 一个命令，差别不大。但 opencode 有 23 个命令，全局选项就很重要——`--debug` 对所有 23 个命令都有效。

## 运行

```bash
# 正常模式
bun run src/index.ts run "你好"

# 调试模式
bun run src/index.ts run --debug "你好"
# 或简写
bun run src/index.ts run -d "你好"

# 看 --debug 出现在帮助里
bun run src/index.ts run --help
```

## 对照 opencode

opencode 的 middleware（`src/index.ts:66-78`）：

```ts
.middleware(async (opts) => {
  if (opts.printLogs) process.env.OPENCODE_PRINT_LOGS = "1"
  if (opts.logLevel) process.env.OPENCODE_LOG_LEVEL = opts.logLevel
  if (opts.pure) process.env.OPENCODE_PURE = "1"

  Heap.start()  // 内存监控

  process.env.AGENT = "1"
  process.env.OPENCODE = "1"
  process.env.OPENCODE_PID = String(process.pid)
})
```

和我们的思路一样：**yargs 选项 → 环境变量 → 深层代码读取**。opencode 多了 `Heap.start()`（内存快照）和 `OPENCODE_PID`（进程 ID），我们不需要。

## 本课小结

1. **中间件** = handler 之前运行的函数，做跨命令的通用处理
2. **执行顺序**：builder（声明参数）→ 解析 → middleware（前置处理）→ handler（核心逻辑）
3. **横切关注点**：日志、环境变量、认证等——多个命令都需要、但不属于任何单个命令核心逻辑的功能
4. **选项转环境变量**：深层代码不用层层传参，直接读 `process.env`
5. **`global: true`**：让选项对所有命令有效

下一步：[8.3 对照 opencode + 阶段验收](../03-stage-review/) —— CLI 架构对比 + 验收。
