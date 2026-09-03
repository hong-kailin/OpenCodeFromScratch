// packages/schema/src/index.ts
// schema 包的统一出口（barrel）
// 上层代码从这里导入：import { Message } from "@opencode-from-scratch/schema"
// 对照 opencode: packages/schema/src/index.ts（导出 28 个领域 schema）
//
// 注意：types.ts 里每个 Schema 都同时导出了"值"和"同名的类型"：
//   export const Message = Schema.Struct({...})   // 运行期校验器（值）
//   export type Message = Schema.Schema.Type<...> // 编译期类型（类型）
// TS 允许值和类型同名共存，所以这里一行 export 就把两者都导出去了。
export { ToolCall, Message, ProviderConfig, Config, ResolvedConfig } from "./types"
