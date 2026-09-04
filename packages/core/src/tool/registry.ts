// src/service/tool-registry.ts
// 阶段 11.3 课教学代码：ToolRegistry——把 tools 数组包成 Service
//
// 解决的痛点（阶段 10.1）：index.ts 和 tui/agent.tsx 里各有一份工具数组
// [readTool, writeTool, editTool, bashTool, globTool, grepTool]
// 加第 7 个工具要改两处。现在工具在 Layer 里注册一次，谁需要谁自取。
//
// 三件套（和 config.ts / provider.ts 一样的结构）：
// 1. ToolRegistryApi     -- 声明能力：list() 返回所有已注册的工具
// 2. ToolRegistry        -- tag
// 3. toolRegistryLayer   -- 注册工具列表
//
// 注意：ToolRegistry 不需要依赖别的 Service，所以 Layer 构造函数里
// 用 Effect.sync 直接同步构造（不需要 yield* 取别的服务）。
// 对比 providerLayer（需要 yield* ConfigService），这里的依赖更简单。

import { Context, Effect, Layer } from "effect"
import type { Tool } from "./tool"
import { readTool } from "./read"
import { writeTool } from "./write"
import { editTool } from "./edit"
import { bashTool } from "./bash"
import { globTool } from "./glob"
import { grepTool } from "./grep"

// ── 1. ToolRegistryApi：声明能力 ────────────────────────────
// 只有一个能力：list()，返回当前注册的所有工具
export interface ToolRegistryApi {
  readonly list: () => Tool[]
}

// ── 2. ToolRegistry：tag ────────────────────────────────────
export class ToolRegistry extends Context.Service<ToolRegistry, ToolRegistryApi>()(
  "opencode-from-scratch/ToolRegistry",
) {}

// ── 3. toolRegistryLayer：注册工具 ──────────────────────────
// 所有工具集中在这里注册。以后加第 7 个工具，只改这一个文件。
// 这里不需要依赖别的服务，所以用 Effect.sync 直接同步构造
// （Effect.sync 是"同步的 Effect"：函数体立刻产生一个值，包进 Effect）。
export const toolRegistryLayer = Layer.effect(
  ToolRegistry,
  Effect.sync(() =>
    ToolRegistry.of({
      list: () => [readTool, writeTool, editTool, bashTool, globTool, grepTool],
    }),
  ),
)