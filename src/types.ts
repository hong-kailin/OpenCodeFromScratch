// src/types.ts
// 类型定义：Message 等共享类型

// 一条消息：role 只能是 system/user/assistant，content 是文本
export interface Message {
  role: "system" | "user" | "assistant"
  content: string
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
