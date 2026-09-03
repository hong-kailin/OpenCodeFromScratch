# 15.3 阶段验收

## 验收清单

- [x] 理解 monorepo：一个仓库多个 package，职责单一、依赖清晰
- [x] 理解契约层：schema 包定义共享类型，是依赖树叶子（只依赖 effect）
- [x] 配置 Bun workspaces（root `package.json` 的 `workspaces`）+ tsconfig paths
- [x] 5 个共享类型搬进 schema 包，用 Effect Schema 重写（双重身份）
- [x] 9 个文件导入改为 `@opencode-from-scratch/schema`，config.ts 消除重复定义
- [x] typecheck 通过、CLI 跑通、行为不变

## 验证方式

```bash
bun run typecheck                        # 类型检查通过（含 packages 目录）
bun run src/index.ts run "你好"           # CLI 正常（配置加载、请求构建、流式输出）
```

验证点：
1. `bunx tsc --noEmit` 通过——schema 包 + src 全项目类型无误
2. CLI 跑通——证明从 schema 包导入类型没破坏任何功能（配置解析、请求、流式）
3. `git diff` 干净——每个 src 文件只改了 import 行，中文注释未受影响

## 工程思维

**1. 契约层 = 定义"世界长什么样"的地方**

Schema 包不包含任何业务逻辑，只描述类型。它回答了"Message 长什么样？ToolCall 长什么样？"。
上层所有包只依赖它，它是整棵依赖树的叶子。这是整个 monorepo 分层的地基——
后面阶段 16 的 core、阶段 19 的 server/client 都会从 schema 包取类型。

**2. 依赖方向：上 → 下，下层不知道上层存在**

```
src/（业务）→ packages/schema/（契约）
```

schema 包不知道有 src 的存在，src 知道有 schema。这个单向依赖让代码可维护：
改 schema 包，所有上层都跟着受益；改上层，schema 包不受影响。

**3. 一次"重复定义"的实战教训**

`service/config.ts` 里那个本地 `interface Config`（baseURL/apiKey/modelID）和
`src/types.ts` 里的 `Config`（model/provider 结构）**同名但含义不同**——这就是
单 package 时代"类型重复、边界模糊"的活例子。拆成 schema 包后，我们被迫
命名区分（`Config` vs `ResolvedConfig`），边界一下子清楚了。

**4. 为什么用 Schema 重写而不只是搬 interface**

Schema 的"双重身份"（编译期类型 + 运行期校验器）让共享类型不止是"类型标注"，
还能在运行时校验数据。阶段 19 的 server/client 边界校验会直接用这些 Schema。

## 阶段产出

```
opencode-from-scratch/
├── package.json                 # 加 workspaces: ["packages/*"]
├── tsconfig.json                # 加 paths: @opencode-from-scratch/schema + include packages
├── packages/
│   └── schema/                  # 新增 schema 契约层
│       ├── package.json         # name: @opencode-from-scratch/schema
│       └── src/
│           ├── index.ts         # barrel 导出
│           └── types.ts         # 5 个共享类型（Effect Schema 重写）
└── src/                         # 9 个文件导入改为 schema 包；src/types.ts 删除
```

对照 opencode：`opencode/packages/schema/src/`（28 个领域 schema，index.ts barrel 导出）。
我们 5 个类型，思路一致。

## 下一步

阶段 16：Core 领域服务化——把 session/provider/tool/database 等领域逻辑重构成
Effect Service，搬进新建的 `core` 包。三层结构：`packages/{schema, core}` + `src/`。
