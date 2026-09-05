// packages/core/src/index.ts
// core 包的 barrel 导出：把包内所有公共 API 汇总到一处
// 上层（opencode 包）只需 import { xxx } from "@opencode-from-scratch/core"
// 对照 opencode: packages/core/src/index.ts（也是 barrel）

// ── 服务（Service + Layer）──────────────────────────────
export {
  ConfigService,
  configLayer,
  type ConfigServiceApi,
} from "./config/config"

export {
  ProviderService,
  providerLayer,
  type ProviderServiceApi,
} from "./provider/provider"

export {
  ToolRegistry,
  toolRegistryLayer,
  type ToolRegistryApi,
} from "./tool/registry"

// ── Provider 接口与实现 ─────────────────────────────────
export type { Provider, ChatResult } from "./provider/interface"
export { createOpenAIProvider } from "./provider/openai"
export { createAnthropicProvider } from "./provider/anthropic"

// ── 工具 ────────────────────────────────────────────────
export type { Tool } from "./tool/tool"
export { toJSONSchema, toolToOpenAIFormat } from "./tool/tool"
export { readTool } from "./tool/read"
export { writeTool } from "./tool/write"
export { editTool } from "./tool/edit"
export { bashTool } from "./tool/bash"
export { globTool } from "./tool/glob"
export { grepTool } from "./tool/grep"
export { truncate } from "./tool/truncate"

// ── Filesystem 服务 ─────────────────────────────────────
export {
  FileSystemService,
  fileSystemLayer,
  type FileSystemApi,
} from "./filesystem"

// ── 数据库与存储 ────────────────────────────────────────
export {
  DatabaseService,
  databaseLayer,
  sessionTable,
  messageTable,
} from "./database/database"
export {
  SessionStore,
  sessionStoreLayer,
} from "./session/store"
export type { Session } from "./session/store"

// ── System Context ──────────────────────────────────────
export {
  SystemContext,
  systemContextLayer,
} from "./system-context"

// ── 错误类型 ────────────────────────────────────────────
export { ConfigError, LLMError, ToolError } from "./error/errors"

// ── 调试工具 ────────────────────────────────────────────
export { debug, debugMessages } from "./debug"
