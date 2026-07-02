# 0.4 package.json：项目配置与依赖管理

> 本课目标：理解 package.json 的作用，给项目搭好正式的配置，学会安装依赖和自定义命令。

## 从上一课的悬念说起

上一课讲 import 时提到，除了导入本地文件（`import { add } from "./math-utils"`），还能导入第三方包：

```ts
import yargs from "yargs"  // 不需要 ./，直接写包名
```

但如果你想 `import yargs`，得先把这个包装到项目里。Python 里你用 `pip install yargs`，TS 里用什么？这就需要 package.json 了。

## package.json 是什么

你写 Python 项目时，`pyproject.toml` 是项目的"身份证"——项目名、版本、依赖列表、自定义命令都在里面。TypeScript 项目的对应物是 `package.json`。

| Python 世界 | TypeScript 世界 |
|-------------|-----------------|
| `pyproject.toml` | `package.json` |
| `pip install` | `bun install` / `bun add` |
| `uv.lock` / `poetry.lock` | `bun.lock` |
| `.venv/` | `node_modules/` |

## 创建 package.json

最简单的方式是手动创建。看我们项目的 [`package.json`](../../../package.json)：

```json
{
  "name": "opencode-from-scratch",
  "version": "0.0.1",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "bun run src/index.ts",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@tsconfig/bun": "latest",
    "@types/bun": "latest",
    "typescript": "latest"
  }
}
```

逐块解释。

## 基本字段

```json
{
  "name": "opencode-from-scratch",
  "version": "0.0.1",
  "private": true
}
```

- **`name`**：项目名（类比 `pyproject.toml` 里的 `name`）
- **`version`**：版本号，语义化版本（类比 Python 包版本）
- **`private: true`**：标记为私有项目，防止不小心发布到 npm（类比 Python 私有包）

## type: "module"

```json
"type": "module"
```

这一行很重要。它告诉 Bun/Node：这个项目用 **ESM 模块系统**（`import/export`），而不是老的 CommonJS（`require`）。

> 上一课你学的 `import { add } from "./math-utils"` 就是 ESM 语法。如果不写 `"type": "module"`，`.ts` 文件里的 `import` 可能会报错（默认走 CommonJS）。opencode 的 package.json 也有 `"type": "module"`。

## scripts：自定义命令

```json
"scripts": {
  "dev": "bun run src/index.ts",
  "typecheck": "tsc --noEmit"
}
```

`scripts` 类比 Makefile 或 `pyproject.toml` 的 `[project.scripts]`。定义后用 `bun run <命令名>` 执行：

```bash
bun run dev        # 等价于 bun run src/index.ts
bun run typecheck  # 等价于 tsc --noEmit
```

> 对照 opencode：它的 scripts 里有 `"dev": "bun run --cwd packages/opencode --conditions=browser src/index.ts"`，多了 `--cwd`（切换目录，因为是 monorepo）和 `--conditions=browser`（条件导出）。我们简化版不需要这些。

## dependencies vs devDependencies

```json
"dependencies": {
  "yargs": "^18.0.0"        // 生产依赖：运行时需要的包
},
"devDependencies": {
  "typescript": "latest",    // 开发依赖：只在开发时需要
  "@tsconfig/bun": "latest"
}
```

| | dependencies | devDependencies |
|---|---|---|
| 作用 | 运行时需要的包 | 只在开发/编译/检查时需要 |
| Python 类比 | `dependencies`（在 `pyproject.toml`） | `dev-dependencies` / `optional-dependencies` |
| 例子 | `yargs`（CLI 解析，程序运行要用） | `typescript`（类型检查，部署后不需要） |

**区分原则**：如果用户安装后**运行程序**时还需要这个包，放 `dependencies`；如果只是**开发/编译/检查**时需要，放 `devDependencies`。

> 我们现在只装了 devDependencies（typescript、@tsconfig/bun、@types/bun），因为还没有运行时依赖。等到阶段 1 调 LLM API 时会装第一个 dependencies。

## 安装依赖

创建好 package.json 后，跑：

```bash
bun install
```

这一条命令会读 package.json 的依赖列表，把它们全装到 `node_modules/` 里。类比 `pip install -e .` 或 `uv sync`。

会发生几件事：

1. 下载所有依赖包到 `node_modules/`（类比 `.venv/`，但放在项目根目录）
2. 生成 `bun.lock` 锁文件（类比 `uv.lock`，锁定每个包的精确版本，保证团队一致）

### 添加新依赖

```bash
bun add yargs           # 添加到 dependencies（类比 pip install yargs）
bun add -d typescript   # -d 表示添加到 devDependencies
```

`bun add` 会自动更新 package.json 并写入 `bun.lock`。

### 版本号写法

```json
"typescript": "latest"     // 最新版
"yargs": "^18.0.0"         // 兼容 18.x.x（^ 表示允许 minor/patch 更新）
"yargs": "~18.0.0"         // 兼容 18.0.x（~ 表示只允许 patch 更新）
"yargs": "18.0.0"          // 精确版本
```

> 类比 Python 的版本约束：`^18.0.0` 类似 `>=18.0.0,<19.0.0`。

## node_modules 与 .gitignore

`bun install` 会生成 `node_modules/` 目录，里面是所有依赖包的源码。这个目录**很大**，不能提交到 git。需要 `.gitignore` 忽略它：

```
node_modules/
*.log
.DS_Store
```

> 类比 Python：`.venv/` 也不提交到 git，用 `.gitignore` 忽略。`bun.lock` **要提交**（保证团队依赖版本一致），类比 `uv.lock` 要提交。

## 跑起来验证

创建好 package.json 后：

```bash
# 安装依赖
bun install

# 用 scripts 快捷命令跑程序
bun run dev
```

期望 `bun run dev` 输出 `hello opencode`。

> 注意：现在 `bun run dev` 能跑了，但 `bun run typecheck` 还不行——因为还没有 tsconfig.json（下一课讲）。

## 教 Debug：包找不到

如果你 `import` 了一个没装的包：

```ts
import yargs from "yargs"  // 但没跑过 bun add yargs
```

运行时会报：

```
error: Cannot find module "yargs" from "src/index.ts"
```

这和上一课"模块找不到"的报错一样，但区别是：**没有 `./` 前缀的包名**找不到，说明你没装这个第三方包。解决方法：`bun add yargs`。

> Python 对照：`ModuleNotFoundError: No module named 'yargs'` → `pip install yargs`。

## 本课小结

你学会了：

1. **package.json**：项目元信息 + 依赖清单 + scripts 命令（类比 `pyproject.toml`）
2. **type: "module"**：声明用 ESM 模块系统（和上一课的 import/export 对应）
3. **scripts**：自定义命令，`bun run dev` / `bun run typecheck`
4. **dependencies vs devDependencies**：运行时 vs 开发时依赖
5. **bun install / bun add**：安装依赖 / 添加依赖（类比 `pip install`）
6. **node_modules 与 bun.lock**：前者不提交（.gitignore），后者要提交
7. **读包找不到报错**：Cannot find module + 包名（无 `./`）→ 没装依赖

下一步：[0.5 tsconfig.json](../05-tsconfig/README.md) —— TypeScript 编译配置。
