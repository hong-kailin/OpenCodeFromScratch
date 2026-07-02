# 0.5 tsconfig.json：TypeScript 编译配置

> 本课目标：理解 tsconfig.json 的作用，给项目配好类型检查，学会读 TS 报错。

## 从上一课的悬念说起

上一课创建 package.json 时，scripts 里定义了：

```json
"typecheck": "tsc --noEmit"
```

但我说"`bun run typecheck` 还不行——因为还没有 tsconfig.json"。现在来解决它。

先问一个问题：`bun run src/index.ts` 能直接跑 `.ts` 文件，为什么还需要配置类型检查？

**因为运行和检查是两回事。** Bun 运行时直接跑代码，不做类型检查——类型标注在运行时会被忽略（就像 Python 运行时不检查 type hints）。如果你写了 `const x: number = "hello"`，Bun 照样跑，不会报错。要发现这种类型错误，需要单独跑类型检查器（`tsc`），而 `tsc` 需要一个配置文件告诉它怎么检查——这就是 tsconfig.json。

| | 运行（Bun） | 类型检查（tsc） |
|---|---|---|
| 什么时候 | `bun run` | `bun run typecheck` |
| 做什么 | 执行代码 | 扫描代码找类型错误 |
| 类比 Python | `python script.py` | `mypy script.py` |
| 需要配置 | 不需要 | 需要 tsconfig.json（类比 mypy.ini） |

## tsconfig.json 是什么

`tsconfig.json` 是 TypeScript 编译器/类型检查器的配置文件，告诉 `tsc`：

- 检查哪些文件
- 用什么规则检查
- 路径别名怎么解析

类比 Python 的 `mypy.ini`——告诉 mypy 检查哪些目录、开不开严格模式。

## 创建 tsconfig.json

看我们项目的 [`tsconfig.json`](../../../tsconfig.json)：

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "@tsconfig/bun/tsconfig.json",
  "compilerOptions": {
    "strict": true,
    "noEmit": true,
    "types": ["bun"],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "opencode", "src/error-demo.ts", "src/type-error-demo.ts"]
}
```

`$schema` 字段是给编辑器用的——指向 JSON Schema，让 VSCode 在编辑 tsconfig.json 时能自动补全字段名和提示。opencode 的 tsconfig.json 也有这行。它不影响编译行为，纯编辑器辅助。

逐块解释。

## extends：继承预设

```json
"extends": "@tsconfig/bun/tsconfig.json"
```

`@tsconfig/bun` 是官方维护的 Bun 专用预设，帮你设好了 `target`、`module`、`moduleResolution` 等一堆字段。我们不需要自己写这些，继承预设就行。

> 类比 Python：继承一个基础 `pyproject.toml` 模板，只覆盖自己需要的字段。opencode 的 tsconfig.json 也是这么做的。

## compilerOptions：检查规则

```json
"compilerOptions": {
  "strict": true,
  "noEmit": true,
  "types": ["bun"],
  "paths": {
    "@/*": ["./src/*"]
  }
}
```

### strict: true

开启严格类型检查（类比 `mypy --strict`）。推荐开启，能及早发现类型错误，比如：

- 变量没标注类型时报错（禁止隐式 any）
- 可能为 undefined 的值直接访问时报错

### noEmit: true

只做类型检查，**不输出**编译后的 `.js` 文件。因为 Bun 直接跑 `.ts`，我们不需要编译产物。

> 如果不写 `noEmit: true`，`tsc` 会在每个 `.ts` 旁边生成一个 `.js` 文件，项目里会很乱。

### types: ["bun"]

加载 Bun 的类型定义。**这行很关键**——没有它，`console`、`Bun` 等全局变量会报 "Cannot find name 'console'" 错误。

为什么？因为 `@tsconfig/bun` 预设的 `lib` 不含 DOM 库（DOM 里有 `console`）。Bun 运行时确实有 `console`，但类型检查器不知道。`@types/bun` 包提供了 Bun 环境的类型定义（包括 `console`），`types: ["bun"]` 告诉 tsc 加载它。

> 这个坑我踩过——第一次配 tsconfig 时 `bun run typecheck` 报了一堆 "Cannot find name 'console'"，就是漏了这行。

### paths：路径别名

```json
"paths": {
  "@/*": ["./src/*"]
}
```

这行让 `@` 成为 `src/` 的别名。有了它，你可以写：

```ts
// 没有 paths：相对路径，层级深时很难写
import { read } from "../../../tool/read"

// 有 paths：用 @ 别名，从 src 根开始
import { read } from "@/tool/read"
```

> 对照 opencode：它的 tsconfig.json 里就是 `"paths": {"@/*": ["./src/*"]}`。opencode 源码里到处都是 `import ... from "@/tool/..."`、`import ... from "@/session/..."`。我们后续阶段会大量用到这个别名。

## include 与 exclude：限定检查范围

```json
"include": ["src/**/*.ts"],
"exclude": ["node_modules", "opencode", "src/error-demo.ts"]
```

### include：只检查 src/

`"src/**/*.ts"` 表示检查 `src/` 目录下所有 `.ts` 文件（`**` 是递归匹配任意子目录）。

**这很重要**——如果不限定，`tsc` 会扫描整个项目目录，包括 `opencode/` 参考源码（31 个 package，几百个文件），报一堆和我们无关的错误。

### exclude：排除不需要检查的

- `node_modules`：第三方依赖，不归我们管
- `opencode`：只读参考源码，不归我们管
- `src/error-demo.ts`：0.1 课故意写错的教学代码（演示运行时报错用的），typecheck 会报错，排除掉

> 类比 Python：mypy 配置里也会 exclude `venv/`、`build/` 等目录。

## 跑类型检查

配好 tsconfig.json 后：

```bash
bun run typecheck
```

如果代码没问题，命令**没有任何输出**（静默成功）。如果有类型错误，会打印错误信息。

## 教 Debug：TS 报错怎么读

类型检查报错和运行时报错格式不同。故意写一个类型错误，看 [`src/type-error-demo.ts`](../../../src/type-error-demo.ts)：

```ts
// src/type-error-demo.ts
// 故意写类型错误，演示 tsc 报错格式

const num: number = "hello" // 把 string 赋给 number
```

跑 `bun run typecheck`，会看到：

```
src/type-error-demo.ts:4:7 - error TS2322: Type 'string' is not assignable to type 'number'.

4 const num: number = "hello"
        ~~~
```

读法：

1. **位置** `src/type-error-demo.ts:4:7` —— 文件、第 4 行、第 7 列
2. **错误码** `TS2322` —— TypeScript 的错误编号，可以搜这个码查原因
3. **描述** `Type 'string' is not assignable to type 'number'` —— 把 string 赋给 number 类型变量
4. **`~~~`** —— 标出出错的变量名

> 和运行时报错的区别：类型错误是**编译时**检查出来的，代码根本没跑就报错了。Python 的 mypy 报错也是这个风格。

## 运行时错误 vs 类型错误

现在你见过两种错误了，对比一下：

| | 运行时错误（Bun） | 类型错误（tsc） |
|---|---|---|
| 什么时候发现 | 代码跑到那一行时 | 代码运行前（类型检查阶段） |
| 报错格式 | `ReferenceError: xxx is not defined` | `error TS2322: Type ... is not assignable` |
| 例子 | 访问不存在的变量 | 把 string 赋给 number |
| Python 类比 | `NameError` / `TypeError`（运行时） | mypy 报错（检查时） |

**类型错误越早发现越好**——在写代码时（编辑器红线）就发现，比上线后崩掉好得多。这就是为什么要配 tsconfig + typecheck。

## 跑起来验证

```bash
# 类型检查（应该无输出，表示通过）
bun run typecheck

# 也能正常运行
bun run dev
```

## 本课小结

你学会了：

1. **tsconfig.json**：TS 类型检查器的配置（类比 `mypy.ini`），`tsc` 需要 it 才能工作
2. **extends**：继承 `@tsconfig/bun` 预设，少写配置
3. **strict**：严格类型检查
4. **noEmit**：只检查不产出 .js 文件
5. **types: ["bun"]**：加载 Bun 类型定义，让 `console` 等全局变量被识别
6. **paths**：`@/*` → `./src/*` 路径别名，opencode 大量使用
7. **include/exclude**：限定检查范围，排除 opencode 参考源码和教学错误代码
8. **读 TS 报错**：文件:行:列 + 错误码 TSXXXX + 描述
9. **运行时错误 vs 类型错误**：前者跑到才报，后者运行前就报

下一步：[0.6 VSCode 调试](../06-vscode-debug/README.md) —— 学会用断点调试代码。
