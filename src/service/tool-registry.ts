// src/service/tool-registry.ts
// 10.4 课教学代码：ToolRegistry--把 tools 数组包成 Service
//
// 解决的问题（10.1 痛点）：index.ts 和 tui/agent.tsx 里各有一份
//   [readTool, writeTool, editTool, bashTool, globTool, grepTool]
// 加第 7 个工具要改两处。现在工具在 Layer 里注册一次，谁需要谁自取。
//
// 三件套（和 config.ts / provider.ts 一样的结构）：
// 1. ToolRegistryApi     -- 声明能力：list() 返回所有已注册的工具
// 2. ToolRegistry        -- tag
// 3. toolRegistryLayer   -- 注册工具列表
//
// 对照 opencode: core/src/tool/registry.ts
// opencode 的注册表要复杂得多：register（动态注册）/ materialize（生成 LLM 定义）/
// settle（执行工具）/ permission（权限过滤）/ scoped（作用域生命周期）...
// 我们简化为：一个固定的 list() 返回数组。后续阶段 16-19 再逐步补全
// 到 opencode 的完整注册表。

import { Context, Effect, Layer } from "effect"
import type { Tool } from "../tool/tool"
import { readTool } from "../tool/read"
import { writeTool } from "../tool/write"
import { editTool } from "../tool/edit"
import { bashTool } from "../tool/bash"
import { globTool } from "../tool/glob"
import { grepTool } from "../tool/grep"

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
// Layer.effect 的函数体只跑一次（provide 时执行），list 返回固定的数组。
// 这里不需要依赖别的服务，所以用 Effect.sync 直接同步构造即可
// （Effect.sync 是"同步的 Effect"：函数体立刻产生一个值，包进 Effect）。
export const toolRegistryLayer = Layer.effect(
  ToolRegistry,
  Effect.sync(() =>
    ToolRegistry.of({
      list: () => [readTool, writeTool, editTool, bashTool, globTool, grepTool],
    }),
  ),
)
