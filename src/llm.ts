// src/llm.ts
// 配置加载：读取 opencode.json，解析出 provider 配置
// 跑法：bun run src/index.ts（index.ts 会 import 这个模块）
//
// 历史说明：
// 阶段 1-3 这里还有 chat()、chatStream()、chatWithTools() 函数
// 阶段 6 把 chatWithTools 搬到 src/provider/openai.ts，包成 Provider 接口
// 旧的 chat/chatStream 函数已被 chatWithTools 取代，可以从 git 历史查看

// 读取 opencode.json 配置，解析出 baseURL、apiKey、modelID
export async function loadConfig(): Promise<{ baseURL: string; apiKey: string; modelID: string }> {
  const config = await Bun.file("opencode.json").json()

  // "volcengine-plan/deepseek-v4-flash" 拆成 providerID 和 modelID
  const [providerID, modelID] = config.model.split("/")
  const provider = config.provider[providerID]

  if (!provider) {
    throw new Error(`配置文件里找不到 provider: ${providerID}`)
  }

  return { baseURL: provider.baseURL, apiKey: provider.apiKey, modelID }
}
