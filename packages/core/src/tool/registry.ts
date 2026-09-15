// packages/core/src/tool/registry.ts
// ToolRegistry——工具的注册与查找（阶段 16.5 升级为 opencode 模式）
//
// 阶段 11.3 做了第一版：把 tools 数组包成 Service（只有 list()）
//   痛点（阶段 10.1）：index.ts 和 tui/agent.tsx 里各有一份工具数组，加工具要改两处
//
// 阶段 16.5 升级（对照 opencode core/src/tool/registry.ts 的设计）：
//   opencode 的做法是【去中心化注册】：
//   - 每个工具在自己的文件里有一个 Layer，启动时 register 自己（见 read.ts）
//   - 不存在"列出所有工具的数组"——没有中央列表
//   - 注册表只提供 register / list / get 三个能力
//   - 工具列表由"组装各工具的 Layer"产生（入口的 toolsLayer）
//   16.5 之前是集中数组硬编码（list: () => [readTool, writeTool, ...]），
//   加第 7 个工具要改 registry 的 import + 数组两处。
//   现在改成 opencode 模式：注册表空启动，工具各自注册——
//   加第 7 个工具只需要把它的 Layer 加进入口的 mergeAll，registry 一行不用动。
//
// 注意：工具 execute 内部 yield* FileSystemService（16.4 改动），
// 所以【执行】工具时需要 FileSystem 服务在 Context 里（由 agent-loop 的 provide 保证）。
// ToolRegistry 本身只存工具定义，不需要 FileSystem。

import { Context, Effect, Layer } from "effect"
import type { Tool } from "./tool"

// ── 1. ToolRegistryApi：声明能力 ────────────────────────────
// 三个能力：
//   register(tool)  -- 注册一个工具（工具各自的 Layer 调用）
//   list()          -- 列出所有已注册工具（agent-loop 发 tools 给 LLM 时用）
//   get(id)         -- 按 id 查找单个工具（agent-loop 执行工具调用时用）
// 用 Tool<any, any> 存——不同工具 R 不同，注册表无法统一（16.4 讲过）
export interface ToolRegistryApi {
  readonly register: (tool: Tool<any, any>) => void
  readonly list: () => Tool<any, any>[]
  readonly get: (id: string) => Tool<any, any> | undefined
}

// ── 2. ToolRegistry：tag ────────────────────────────────────
export class ToolRegistry extends Context.Service<ToolRegistry, ToolRegistryApi>()(
  "opencode-from-scratch/ToolRegistry",
) {}

// ── 3. toolRegistryLayer：空注册表 ──────────────────────────
// 关键变化：不再内置任何工具！
// 之前：Layer 构造时硬编码 [readTool, writeTool, ...]
// 现在：只提供一个空的 Map，工具各自的 Layer 启动时 register 进来。
// 谁注册谁、注册哪些，由组装方（入口的 toolsLayer）决定。
export const toolRegistryLayer = Layer.effect(
  ToolRegistry,
  Effect.sync(() => {
    const tools = new Map<string, Tool<any, any>>()

    return ToolRegistry.of({
      // register：按 id 存进 Map（同名工具后注册的覆盖先注册的）
      register: (tool) => {
        tools.set(tool.id, tool)
      },
      // list：返回所有已注册工具
      list: () => Array.from(tools.values()),
      // get：按 id 查单个工具（找不到返回 undefined）
      get: (id) => tools.get(id),
    })
  }),
)
