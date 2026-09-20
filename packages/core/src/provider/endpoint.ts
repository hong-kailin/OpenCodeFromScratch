// Endpoint 只负责描述并构造“请求发到哪里”。
// 它不知道 API key、请求 body，也不解析响应。
//
// 对照 opencode: packages/llm/src/route/endpoint.ts

// 当前项目只需要固定 path，所以先保留最小结构。
// 真实 opencode 还允许 path 根据请求 body 动态计算，并支持 query 参数；
// 等项目真正遇到这些需求时再补，不提前搬入复杂度。
export interface Endpoint {
  readonly baseURL: string
  readonly path: string
}

// 把配置中的 baseURL 和路线自己的 path 合成标准 URL。
// baseURL 末尾可能由用户写一个或多个 /，path 也可能漏写开头的 /；
// 在一个边界里统一处理后，Provider 不需要到处判断斜杠。
export function renderEndpoint(endpoint: Endpoint): URL {
  const baseURL = endpoint.baseURL.replace(/\/+$/, "")
  const path = endpoint.path.startsWith("/") ? endpoint.path : `/${endpoint.path}`

  return new URL(`${baseURL}${path}`)
}
