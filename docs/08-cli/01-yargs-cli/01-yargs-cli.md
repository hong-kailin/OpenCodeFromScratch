# 8.1 yargs 构建 CLI：命令与选项

> 本课目标：用 yargs 把 `src/index.ts` 改造成正式 CLI 工具，支持命令行选项（`--continue`、`--session`）和非交互模式。

## 当前问题

我们的 `src/index.ts` 直接执行对话循环，没有命令行解析：
- 不能传参数（比如"恢复上次会话"要手动选）
- 不能单次运行（必须进交互模式）
- 没有帮助信息（`--help`）

## yargs 是什么

yargs 是 Node.js/Bun 的命令行解析库，类似 Python 的 argparse 或 click。

### process.argv：原始命令行参数

在用 yargs 之前，先理解 Bun/Node.js 怎么拿命令行参数。所有参数都在 `process.argv` 数组里：

```bash
bun run src/index.ts run "你好" -c
```

```ts
// process.argv 的值：
// [
//   "/path/to/bun",           ← [0] 运行时路径（没用）
//   "/path/to/src/index.ts",  ← [1] 脚本路径（没用）
//   "run",                    ← [2] 用户传的参数开始
//   "你好",
//   "-c",
// ]
```

> Python 类比：`sys.argv` 一模一样——`sys.argv[0]` 是脚本名，`sys.argv[1:]` 是参数。

前两个元素（运行时 + 脚本路径）我们不需要。`hideBin(process.argv)` 就是帮你切掉前两个，只留用户传的参数：

```ts
import { hideBin } from "yargs/helpers"

hideBin(process.argv)
// ["run", "你好", "-c"]  ← 只剩用户传的参数
```

> Python 类比：`sys.argv[1:]`。

### yargs 基本用法

```ts
import yargs from "yargs"
import { hideBin } from "yargs/helpers"

yargs(hideBin(process.argv))    // ① 传入参数
  .command(                     // ② 定义命令
    "run [message..]",          //    命令格式
    "运行 agent",                //    描述（--help 里显示）
    (yargs) => {                //    builder：定义这个命令的参数
      return yargs
        .positional("message", { type: "string", array: true, default: [] })
        .option("continue", { alias: "c", type: "boolean", description: "恢复上次会话" })
        .option("session", { alias: "s", type: "string", description: "恢复指定 session" })
    },
    async (args) => {           //    handler：参数解析完后执行
      console.log(args.message)   // ["你好"]
      console.log(args.continue)  // true
      console.log(args.session)   // undefined
    },
  )
  .parse()                      // ③ 解析并执行
```

逐行解释：

**① `yargs(hideBin(process.argv))`**：把用户传的参数交给 yargs 解析。返回一个 yargs 实例（可以链式调用）。

**② `.command(...)`**：定义一个命令。四个参数：

| 参数 | 值 | 作用 |
|------|-----|------|
| 命令格式 | `"run [message..]"` | `run` 是命令名，`[message..]` 是位置参数（`..` 表示数组，`[]` 表示可选） |
| 描述 | `"运行 agent"` | `--help` 里显示的说明 |
| builder | `(yargs) => { ... }` | 声明这个命令接受哪些参数（见下方详解） |
| handler | `async (args) => { ... }` | 参数解析完后执行的业务逻辑（见下方详解） |

### builder 详解：声明参数

builder 是一个函数，**作用是告诉 yargs 这个命令接受哪些参数**。它像一个"参数声明表"——你在这里声明有哪些参数、什么类型、什么默认值，yargs 就按这个声明去解析命令行。

**builder 什么时候被调用？**

当 yargs 匹配到 `run` 命令时，先调用 builder。builder 执行完后，yargs 才知道这个命令的参数格式，然后按这个格式去解析剩余的命令行参数。

```
用户输入: bun run src/index.ts run "你好" -c
                                     ↓
yargs 读取参数: ["run", "你好", "-c"]
                                     ↓
匹配到 "run" 命令
                                     ↓
调用 builder → builder 声明: "我有 message（位置参数）、continue（布尔选项）、session（字符串选项）"
                                     ↓
yargs 按声明解析剩余参数: "你好" → message, "-c" → continue
                                     ↓
调用 handler，传入解析结果
```

**builder 里的两个方法**：

- `.positional("message", { ... })`：定义位置参数（不是 `--xxx` 形式的参数，直接写在命令后面）
  - `type: "string"`：类型是字符串
  - `array: true`：可以多个（`run "你好" "世界"` → `["你好", "世界"]`）
  - `default: []`：不传时默认空数组

- `.option("continue", { ... })`：定义选项（`--xxx` 形式的参数）
  - `alias: "c"`：简写（`-c` 等同 `--continue`）
  - `type: "boolean"`：布尔类型（不传值，出现就是 true）
  - `description`：`--help` 里显示的说明

> builder 的返回值是配置好的 yargs 实例。yargs 拿到这个实例后，就知道怎么解析参数了。

> Python 类比：builder 做的事就是 argparse 里 `add_argument()` 那些调用——声明参数名、类型、默认值。只不过 argparse 是命令式地一个个 add，yargs 是在 builder 函数里链式调用。

### handler 详解：执行业务逻辑

handler 是一个函数，**作用是执行这个命令的实际逻辑**。它是整个命令的核心——builder 只是声明参数，handler 才是真正干活的地方。

**handler 什么时候被调用？**

在 builder 执行完、yargs 按声明解析完所有参数之后。yargs 把解析结果打包成 `args` 对象，传给 handler：

```
builder 执行（声明参数）
    ↓
yargs 解析命令行参数
    ↓
handler 执行（使用解析后的参数，干实际的事）
```

**handler 接收的 `args` 对象**：

用户执行 `run "你好" -c` 时，handler 收到的 `args`：

```ts
args = {
  message: ["你好"],     // positional 参数，builder 声明了 array:true，所以是数组
  continue: true,        // --continue / -c，builder 声明了 type:"boolean"，所以是布尔
  session: undefined,    // 没传 --session，所以是 undefined
}
```

用户执行 `run -s ses_123` 时：

```ts
args = {
  message: [],           // 没传位置参数，用 default: []
  continue: false,       // 没传 -c，布尔类型默认 false
  session: "ses_123",    // --session 的值
}
```

**handler 里做什么**：就是之前 `src/index.ts` 的全部逻辑——加载配置、创建 provider、选择 session、对话循环。`args` 里的值决定了行为（比如 `args.continue` 为 true 就恢复上次会话，而不是新建）。

> Python 类比：handler 就是 `args = parser.parse_args()` 之后的那些代码——用解析好的参数执行业务逻辑。argparse 把声明和逻辑写在一起，yargs 用 builder 和 handler 把它们分开了。

**③ `.parse()`**：启动解析。yargs 读取参数、匹配命令、调用 builder 定义参数格式、最后调用 handler。

> Python 类比（完整对照）：
> ```python
> import argparse
>
> parser = argparse.ArgumentParser()
> sub = parser.add_subparsers(dest="command")
>
> # 定义 run 子命令
> run = sub.add_parser("run", help="运行 agent")
> # positional 参数
> run.add_argument("message", nargs="*", default=[], help="非交互模式消息")
> # --continue / -c
> run.add_argument("-c", "--continue", action="store_true", help="恢复上次会话")
> # --session / -s
> run.add_argument("-s", "--session", type=str, help="恢复指定 session")
>
> args = parser.parse_args()
> # args.message, args.continue, args.session
> ```

### 链式调用

yargs 用**链式调用**（method chaining）——每个方法返回 yargs 实例，可以继续调用：

```ts
yargs(args)
  .command(...)     // 定义命令，返回 yargs
  .demandCommand(1) // 要求至少一个命令，返回 yargs
  .strict()         // 未知参数报错，返回 yargs
  .help("help")     // 启用 --help，返回 yargs
  .parse()          // 解析，不返回（执行 handler）
```

> Python 类比：像 SQLAlchemy 的链式查询 `session.query(User).filter(...).order_by(...).all()`，每个方法返回查询对象，可以继续链式调用。

## CLI 设计

我们的 CLI 支持：

```bash
# 交互模式（和之前一样）
bun run src/index.ts run

# 非交互模式：发一条消息，拿到回复，退出
bun run src/index.ts run "你好"

# 恢复上次会话
bun run src/index.ts run -c

# 恢复指定 session
bun run src/index.ts run -s ses_1700000000_abc123

# 帮助
bun run src/index.ts --help
bun run src/index.ts run --help
```

### 选项说明

| 选项 | 简写 | 类型 | 作用 |
|------|------|------|------|
| `--continue` | `-c` | boolean | 恢复最近更新的 session |
| `--session` | `-s` | string | 恢复指定 ID 的 session |
| `message` | （位置参数） | string[] | 非交互模式的消息 |

## 交互模式 vs 非交互模式

**交互模式**（不传 message）：进入 `while(true)` 循环，持续对话。

**非交互模式**（传了 message）：发一条消息，拿到回复，退出。适合脚本调用：
```bash
bun run src/index.ts run "src/index.ts 里写了什么？"
```

> 对照 opencode：它的 `run` 命令也是这个设计——有 message 就非交互，没有就交互。

## 代码结构

`src/index.ts` 用 yargs 定义 `run` 命令，handler 里：
1. 加载配置、创建 provider、构建 system prompt
2. 根据 `--continue`/`--session` 决定恢复哪个 session（或新建）
3. 如果有 message：非交互模式（发消息 → 回复 → 退出）
4. 如果没有 message：交互模式（while 循环）

## 运行

```bash
# 交互模式
bun run src/index.ts run

# 非交互模式
bun run src/index.ts run "你好"

# 恢复上次
bun run src/index.ts run -c

# 帮助
bun run src/index.ts run --help
```

## 对照 opencode

| | 我们的 CLI | opencode 的 CLI |
|---|-----------|-----------------|
| 命令数 | 1 个（run） | 23 个（run、serve、session、models...） |
| 选项数 | 3 个 | 20+ 个（--model、--agent、--format、--file...） |
| 命令包装 | 直接 yargs handler | effectCmd（Effect + 项目实例管理） |
| 默认命令 | 无（必须写 `run`） | `$0`（直接 `opencode` 启动 TUI） |
| 全局选项 | 无 | --print-logs、--log-level、--pure |

## 本课小结

1. **yargs** 是命令行解析库，类比 Python 的 argparse/click
2. **命令 + 选项**：`run [message..]` + `--continue`/`--session`
3. **交互 vs 非交互**：有 message 就单次运行，没有就进循环
4. **opencode 有 23 个命令**，我们简化为 1 个

下一步：[8.2 对照 opencode + 阶段验收](../02-stage-review/) —— CLI 架构对比 + 验收。
