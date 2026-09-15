// packages/core/src/index.ts
// core 包的 barrel 导出：把包内所有公共 API 汇总到一处
// 上层（opencode 包）只需 import { xxx } from "@opencode-from-scratch/core"
// 对照 opencode: packages/core/src/index.ts（也是 barrel）

// ── 服务（Service + Layer，阶段 11-12 已做）────────────────
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
export { readTool, readToolLayer } from "./tool/read"
export { writeTool, writeToolLayer } from "./tool/write"
export { editTool, editToolLayer } from "./tool/edit"
export { bashTool, bashToolLayer } from "./tool/bash"
export { globTool, globToolLayer } from "./tool/glob"
export { grepTool, grepToolLayer } from "./tool/grep"
export { truncate } from "./tool/truncate"

// ── Filesystem 服务（16.3）────────────────────────────────
export {
  FileSystemService,
  fileSystemLayer,
  type FileSystemApi,
} from "./filesystem"

// ── 数据库与存储（16.2 Database 服务，16.6 SessionStore 服务）─
export {
  DatabaseService,
  databaseLayer,
} from "./database/database"
export { sessionTable, messageTable } from "./database/sql"
export {
  SessionStore,
  sessionStoreLayer,
  type Session,
} from "./session/store"

// ── System Context（16.7 服务化）────────────────────────────
export {
  SystemContext,
  systemContextLayer,
} from "./system-context"

// ── 错误类型 ────────────────────────────────────────────
export { ConfigError, LLMError, ToolError } from "./error/errors"

// ── 调试工具 ────────────────────────────────────────────
export { debug, debugMessages } from "./debug"
