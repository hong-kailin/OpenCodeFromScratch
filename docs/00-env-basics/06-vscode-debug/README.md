# 0.6 VSCode 调试：断点与调试器

> 本课目标：学会用 VSCode 断点调试 TypeScript 代码，不再只靠 console.log。

## 为什么需要断点调试

到目前为止你用 `console.log` 打点调试——在代码里加打印语句，看变量值对不对。这很有效，但有局限：

- 想看某个条件下的变量值，要加 `if` + `console.log`，改完再跑一遍
- 想看函数调用链，要手动一层层加打印
- 程序状态复杂时（比如循环里、多层嵌套），打印太多看不过来

断点调试解决这些问题：**暂停程序、查看所有变量、一步步执行、随时改变量**。就像 Python 里用 `pdb` 或 PyCharm 的调试器，只是换到 VSCode + Bun。

## 准备：安装 Bun 扩展

VSCode 默认不会调试 Bun，需要装扩展：

1. 打开 VSCode，左侧 Extensions 面板（快捷键 `Cmd+Shift+X`）
2. 搜索 `Bun`，安装 **"Bun for Visual Studio Code"**（作者是 Oven Software）
3. 装好后 VSCode 就能识别 Bun 的调试类型

## launch.json：调试配置

VSCode 调试需要一份配置文件告诉它"调试什么、怎么调试"。看我们项目的 [`.vscode/launch.json`](../../../.vscode/launch.json)：

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "bun",
      "request": "launch",
      "name": "Debug Current File",
      "program": "${file}",
      "cwd": "${workspaceFolder}"
    }
  ]
}
```

逐字段解释：

- **`type: "bun"`**：调试类型是 Bun（刚装的扩展提供）
- **`request: "launch"`**：启动模式，直接启动程序并调试。另一种是 `attach`（附加到已运行的进程），opencode 用的就是 attach 模式
- **`name`**：配置名，显示在调试面板下拉菜单里
- **`program: "${file}"`**：调试当前打开的文件。`${file}` 是 VSCode 变量，表示当前编辑器里打开的文件
- **`cwd: "${workspaceFolder}"`**：工作目录设为项目根目录

> 对照 opencode：它的 [`.vscode/launch.example.json`](../../../opencode/.vscode/launch.example.json) 用的是 `attach` 模式，连到 `ws://localhost:6499/`——因为它要调试的是正在运行的 TUI 程序。我们用更简单的 `launch` 模式，直接启动调试。

## 设断点

断点是最基本的调试操作：

1. 在 VSCode 里打开 [`src/debug-target.ts`](../../../src/debug-target.ts)
2. 把光标移到某一行，点击行号左侧的灰色区域——出现**红点**，表示设了断点
3. 也可以用快捷键 `F9` 切换当前行断点

> 类比 Python：和 PyCharm / VSCode Python 调试器完全一样——行号左边点一下设断点。

## 开始调试

设好断点后，开始调试：

1. 打开要调试的文件（如 `src/debug-target.ts`）
2. 按 `F5`（或左侧调试面板 → 选 "Debug Current File" → 点绿色播放按钮）
3. 程序启动，跑到断点处**暂停**

## 调试面板

程序暂停后，VSCode 左侧会显示调试面板：

| 面板 | 作用 | Python 类比 |
|------|------|-------------|
| **Variables** | 当前作用域的所有变量值 | PyCharm 的 Variables 面板 |
| **Watch** | 手动添加要监视的表达式 | PyCharm 的 Watches |
| **Call Stack** | 函数调用链（谁调用了当前函数） | Python 的 traceback，但是是"正向"的 |
| **Breakpoints** | 所有断点列表，可以启用/禁用 | — |

### 单步执行

程序暂停后，用这些按钮一步步走：

| 按钮 | 快捷键 | 作用 | Python 类比 |
|------|--------|------|-------------|
| Continue | `F5` | 继续运行到下一个断点 | pdb 的 `c` (continue) |
| Step Over | `F10` | 执行当前行，不进入函数内部 | pdb 的 `n` (next) |
| Step Into | `F11` | 执行当前行，**进入**函数内部 | pdb 的 `s` (step) |
| Step Out | `Shift+F11` | 执行完当前函数，回到调用处 | pdb 的 `r` (return) |
| Restart | `Cmd+Shift+F5` | 重新开始调试 | — |
| Stop | `Shift+F5` | 停止调试 | — |

> **Step Over vs Step Into 的区别**：当前行调用了函数 `foo()`——Step Over 执行完 `foo()` 停在下一行（把 `foo()` 当一步）；Step Into 会进入 `foo()` 内部暂停。

## 实操：调试 debug-target.ts

打开 [`src/debug-target.ts`](../../../src/debug-target.ts)，这个文件模拟一个"算成绩平均值"的逻辑，我们用断点看中间变量：

```ts
// src/debug-target.ts
function calculateAverage(scores: number[]): number {
  const sum = scores.reduce((acc, s) => acc + s, 0)
  const average = sum / scores.length   // ← 在这行设断点
  return average
}

const scores = [85, 92, 78, 96, 88]
const result = calculateAverage(scores)
console.log("平均分:", result)
```

操作步骤：

1. 打开 `src/debug-target.ts`
2. 在 `const average = sum / scores.length` 这行设断点（点行号左侧）
3. 按 `F5` 开始调试
4. 程序暂停在断点处：
   - **Variables** 面板能看到 `sum = 439`、`scores = [85, 92, 78, 96, 88]`
   - **Call Stack** 显示 `calculateAverage` ← 全局作用域
5. 按 `F10`（Step Over），`average` 变量出现，值是 `87.8`
6. 按 `F5`（Continue），程序跑完，终端输出 `平均分: 87.8`

## 进阶：条件断点

有时你不想每次都停，只想在**特定条件**下停。比如循环里只想看第 3 次迭代：

1. 右键点击行号左侧的断点红点
2. 选 "Edit Breakpoint..."
3. 输入条件表达式，比如 `i === 3`

程序只有当 `i === 3` 时才在这个断点暂停。类比 Python 里 `breakpoint()` 加 `if` 判断，但不用改代码。

## 进阶：日志断点（Logpoint）

如果你想打印变量但**不想暂停程序**——用日志断点：

1. 右键点击行号左侧
2. 选 "Add Logpoint..."
3. 输入要打印的内容，比如 `sum is {sum}`

程序跑到这行不会暂停，只在调试控制台打印一条消息。相当于自动加了一行 `console.log`，但不用改代码、不用重新跑。

> **什么时候用断点 vs console.log**：
> - **断点**：复杂逻辑、想看多个变量、想一步步走 → 用断点
> - **console.log**：快速看一个值、简单确认 → 用 console.log（更快，不用开调试器）
> - **日志断点**：循环里想看每次迭代的值，但不想暂停 → 用 Logpoint

## 教 Debug：按 F5 闪一下就没了

按 F5 后调试器启动了但瞬间消失？常见原因和解决方法：

1. **断点位置不对**：断点必须设在**会执行的代码行**上。比如设在 `function` 声明行上不会触发，要设在函数体内的语句行。确认断点是实心红点，且所在行会被执行到
2. **断点设成灰色空心圆**：断点被禁用了，点击红点重新启用（实心红才是启用的）
3. **断点所在的代码没执行到**：比如断点设在 `if` 块里但条件没满足。用条件断点或换一行设

## 本课小结

你学会了：

1. **launch.json**：VSCode 调试配置，`type: "bun"` + `request: "launch"`
2. **设断点**：行号左侧点击或 `F9`，断点要设在会执行的语句行上
3. **调试面板**：Variables（变量）、Watch（监视）、Call Stack（调用链）
4. **单步执行**：Step Over（`F10`，不进函数）、Step Into（`F11`，进函数）、Step Out（`Shift+F11`，出函数）
5. **条件断点**：只在满足条件时暂停
6. **日志断点**：不暂停只打印
7. **断点 vs console.log**：复杂用断点，简单用 console.log

下一步：[0.7 阶段验收](../07-stage-review/README.md) —— 跑起来 + 工程思维总结。
