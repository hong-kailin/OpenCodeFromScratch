// src/types.ts
// 类型定义：Message、ToolCall 等共享类型

// 工具调用（LLM 返回的，告诉你要调什么工具、传什么参数）
export interface ToolCall {
  id: string // 这次调用的唯一 ID（喂回结果时要带上）
  type: "function" // 固定值
  function: {
    name: string // 工具名（如 "read"）
    arguments: string // 参数，是 JSON 字符串（不是对象，要 JSON.parse）
  }
}

// 一条消息
// 扩展：支持 tool_calls（assistant 消息）和 tool role（工具结果）
export interface Message {
  role: "system" | "user" | "assistant" | "tool"
  content: string | null // assistant 带 tool_calls 时 content 可能是 null
  tool_calls?: ToolCall[] // 只有 assistant 消息有（LLM 返回工具调用时）
  tool_call_id?: string // 只有 tool 消息有（对应 tool_calls 的 id）
}

// 配置文件里的 provider 结构
export interface ProviderConfig {
  name: string
  baseURL: string
  apiKey: string
  models: Record<string, object>
}

// 配置文件结构
export interface Config {
  model: string
  provider: Record<string, ProviderConfig>
}
