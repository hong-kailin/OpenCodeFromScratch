# 0.3 模块系统：import 与 export

> 本课目标：理解 TS/JS 的模块系统，学会把代码拆成多文件并用 import/export 互相关联。

## 为什么需要模块

目前为止我们写的代码都在一个文件里。但 opencode 有几百个文件——`session/`、`tool/`、`agent/` 各管各的。代码长了就要拆文件，拆了文件就要有办法互相调用。

Python 你已经很熟悉了：

```python
# math_utils.py
def add(a, b):
    return a + b

# main.py
from math_utils import add      # 从 math_utils.py 导入 add 函数
print(add(1, 2))
```

TypeScript 的思路完全一样，只是语法不同：用 `export` 导出，用 `import` 导入。

## export：导出

在 TS 里，想 让别的文件用你写的函数/类型/变量，前面加 `export`：

```ts
// src/math-utils.ts

// 命名导出：加 export 关键字
export function add(a: number, b: number): number {
  return a + b
}

export function multiply(a: number, b: number): number {
  return a * b
}

// 也可以导出类型
export type Operation = "add" | "multiply"
```

```python
# Python 对照：在 math_utils.py 里
def add(a, b):       # Python 默认所有顶层定义都能被 import
    return a + b     # 不需要写 export

def multiply(a, b):
    return a * b
```

> 关键区别：Python 默认所有顶层定义都能被导入，TS 必须显式写 `export` 才行。不写 `export` 的东西是模块私有的，外部访问不到。

## import：导入

```ts
// src/main.ts

// 从本地文件导入：注意要写 .ts 扩展名（Bun 运行时可以省略，但写上也行）
// 花括号里是要导入的名字，必须和 export 的名字一致
import { add, multiply, type Operation } from "./math-utils"

const result = add(1, 2)
const op: Operation = "add"
```

```python
# Python 对照
from math_utils import add, multiply, Operation
```

几个要点：

1. **`"./math-utils"`**：以 `./` 开头表示**相对路径**（当前目录）。类比 Python 的 `from math_utils import ...`
2. **花括号 `{ }`**：命名导入，只导入你需要的那几个。类比 Python 的 `from math_utils import add, multiply`
3. **`type Operation`**：`type` 前缀表示只导入类型（编译后会被删除，不占运行时体积）。类型和函数可以混在一个 import 语句里

## 跑一下

看教学代码 [`src/math-utils.ts`](../../../src/math-utils.ts) 和 [`src/module-demo.ts`](../../../src/module-demo.ts)：

```bash
bun run src/module-demo.ts
```

## 默认导出 vs 命名导出

上面用的是**命名导出**（named export），一个文件可以 export 多个东西。还有一种叫**默认导出**（default export），一个文件只能有一个：

```ts
// src/logger.ts

// 默认导出：一个文件只能有一个 default
export default function log(message: string): void {
  console.log(`[LOG] ${message}`)
}

// 也可以同时有命名导出
export const LOG_LEVEL = "info"
```

```ts
// src/main.ts

// 导入默认导出：不用花括号，名字随你取
import log from "./logger"

// 导入命名导出：用花括号
import { LOG_LEVEL } from "./logger"

// 混合导入
import log, { LOG_LEVEL } from "./logger"
```

```python
# Python 没有默认导出的概念
# 最接近的类比是 __all__ 控制 from module import * 的行为，但用法完全不同
```

> **opencode 的约定**：几乎只用命名导出，不用默认导出。看 opencode 源码 [`opencode/packages/opencode/src/index.ts:3`](../../../opencode/packages/opencode/src/index.ts)：

```ts
import { RunCommand } from "./cli/cmd/run"
import { GenerateCommand } from "./cli/cmd/generate"
import { ConsoleCommand } from "./cli/cmd/account"
```

全是花括号命名导入。我们也跟随这个约定。

## 第三方包的导入

除了本地文件，还能导入第三方包（通过 `bun install` 安装的）：

```ts
// 导入第三方包：不需要路径，直接写包名
import yargs from "yargs"                          // 默认导入
import { hideBin } from "yargs/helpers"            // 命名导入，子路径
```

```python
# Python 对照
import yargs                        # import 包
from yargs.helpers import hideBin   # 从包的子模块导入
```

第三方包的导入不需要 `./` 前缀，直接写包名。这个我们在下一课（package.json）装依赖时会用到。

## import 的路径写法

| 写法 | 含义 | 例子 |
|------|------|------|
| `"./foo"` | 当前目录的 foo 文件 | `import { add } from "./math-utils"` |
| `"../foo"` | 上级目录的 foo 文件 | `import { add } from "../utils/math-utils"` |
| `"包名"` | 第三方包（node_modules 里） | `import yargs from "yargs"` |
| `"@/foo"` | 路径别名（需要 tsconfig 配置） | `import { add } from "@/utils/math"` |

最后一种 `@/` 别名需要 tsconfig.json 配置（下下课讲），opencode 源码大量使用。现在你只需要知道 `./` 和 `../` 两种相对路径写法。

## 教 Debug：模块找不到

import 写错路径会报错：

```
error: Cannot find module "./math-util" from "src/main.ts"
```

读法：

1. `Cannot find module` —— 找不到模块
2. `"./math-util"` —— 你写的路径
3. `from "src/main.ts"` —— 在哪个文件里 import 的

常见原因：路径写错（`math-utils` 写成 `math-util`）、文件名拼错、忘记 `./` 前缀（写成 `"math-utils"` 会被当成第三方包去找）。

> Python 对照：类似 `ModuleNotFoundError: No module named 'math_util'`。排查方法一样——检查文件名和路径。

## 本课小结

你学会了：

1. **export**：导出函数/类型/变量，让别的文件能用（Python 默认都能导入，TS 要显式 export）
2. **import**：导入其他文件的导出，花括号 `{ }` 是命名导入
3. **默认导出 vs 命名导出**：opencode 只用命名导出，我们也跟随
4. **路径写法**：`./` 当前目录、`../` 上级目录、包名是第三方包
5. **读模块报错**：Cannot find module → 检查路径和文件名

下一步：[0.4 package.json](../04-package-json/README.md) —— 项目配置与依赖管理。
