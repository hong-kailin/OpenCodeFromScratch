// src/tool/tool.ts
// Tool 接口定义：所有工具都实现这个接口
// 对照 opencode: packages/opencode/src/tool/tool.ts 的 Def 接口

// JSON Schema 的简化类型定义
// JSON Schema 是一种描述 JSON 结构的标准，OpenAI API 用它描述工具参数
export interface JSONSchema {
  type: string // "object" / "string" / "number" 等
  properties?: Record<string, JSONSchema> // 对象的属性
  required?: string[] // 必填字段列表
  description?: string // 字段说明（LLM 看的）
}

// 一个工具的完整定义
// 对照 opencode 的 Def 接口，我们简化了：
// - 去掉 Effect（用 async/await 代替）
// - 去掉 Schema（用 JSONSchema 代替）
// - 去掉 Context（后续阶段加权限/abort 等）
// - execute 返回 string（opencode 返回 ExecuteResult 带 title/metadata）
export interface Tool {
  id: string // 工具名（LLM 用这个名字调用，如 "read"）
  description: string // 工具说明（LLM 根据这个决定要不要用）
  parameters: JSONSchema // 参数格式（JSON Schema）
  execute(args: Record<string, unknown>): Promise<string> // 执行函数，返回文本结果
}

// 把我们的 Tool 定义转成 OpenAI API 的 tools 格式
// API 需要的格式：{ type: "function", function: { name, description, parameters } }
// 这个函数就是把 Tool 的字段重新包装成 API 需要的嵌套结构
export function toolToOpenAIFormat(tool: Tool) {
  return {
    type: "function" as const,
    function: {
      name: tool.id,
      description: tool.description,
      parameters: tool.parameters,
    },
  }
}
