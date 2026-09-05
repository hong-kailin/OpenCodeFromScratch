// src/tool/registry.ts
// ToolRegistry——工具的注册与查找（阶段 16.4 升级）
//
// 阶段 11.3 做了第一版：把 tools 数组包成 Service（只有 list()）
//   痛点（阶段 10.1）：index.ts 和 tui/agent.tsx 里各有一份工具数组，加工具要改两处
//   list() 解决了"集中注册"：工具在 Layer 里注册一次，谁需要谁自取
//
// 阶段 16.4 升级：从"静态数组"变成"可注册的注册表"（register + list + get）
//   之前：list() 返回写死的数组 [readTool, writeTool, ...]
//   现在：内部维护一个 Map，register() 注册、list() 列出、get() 查找
//   为什么升级：对齐 opencode 的 core/src/tool/registry.ts
//     - opencode 的注册表支持"动态注册"（插件、MCP server 随时加工具）
//     - 我们先用最简 Map 版，后面阶段（插件/MCP）会用到 register 的能力
//
// 注意：工具 execute 内部 yield* FileSystem.Service（16.3 改动），
// 所以【执行】工具时需要 FileSystem 服务在 Context 里（由 agent-loop 的 provide 保证）。
// ToolRegistry 本身只存工具定义，不需要 FileSystem。

import { Context, Effect, Layer } from "effect"
import type { Tool } from "./tool"
import { readTool } from "./read"
import { writeTool } from "./write"
import { editTool } from "./edit"
import { bashTool } from "./bash"
import { globTool } from "./glob"
import { grepTool } from "./grep"

// ── 1. ToolRegistryApi：声明能力 ────────────────────────────
// 三个能力：
//   register(tool)  -- 注册一个工具（重复注册 id 会覆盖？先简单处理：允许）
//   list()          -- 列出所有已注册工具（agent-loop 发 tools 给 LLM 时用）
//   get(id)         -- 按 id 查找单个工具（agent-loop 执行工具调用时用）
export interface ToolRegistryApi {
  readonly register: (tool: Tool<any, any>) => void
  readonly list: () => Tool<any, any>[]
  readonly get: (id: string) => Tool<any, any> | undefined
}

// ── 2. ToolRegistry：tag ────────────────────────────────────
export class ToolRegistry extends Context.Service<ToolRegistry, ToolRegistryApi>()(
  "opencode-from-scratch/ToolRegistry",
) {}

// ── 3. toolRegistryLayer：注册工具 ──────────────────────────
// 内部维护一个 Map<工具id, 工具定义>。
// 内置 6 个工具在 Layer 构造时注册，后续 register() 可以动态加（插件/MCP 用）。
// 用 Effect.sync 同步构造（不需要依赖别的服务）。
export const toolRegistryLayer = Layer.effect(
  ToolRegistry,
  Effect.sync(() => {
    // Map<工具id, 工具定义>。存的是"任意工具"——不同工具的参数 Schema 和
    // 服务需求（R）都可能不同，所以用宽松的类型（Tool<any, any>）
    // 类比 Python: dict[str, Tool]，Tool 是基类，子类各有各的参数
    const tools = new Map<string, Tool<any, any>>()

    // 注册内置工具（对照 opencode: application-tools.ts 里注册应用级工具）
    for (const tool of [readTool, writeTool, editTool, bashTool, globTool, grepTool]) {
      tools.set(tool.id, tool)
    }

    return ToolRegistry.of({
      register: (tool) => {
        tools.set(tool.id, tool)
      },
      list: () => Array.from(tools.values()),
      get: (id) => tools.get(id),
    })
  }),
)
