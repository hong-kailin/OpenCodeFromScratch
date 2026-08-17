// src/service/config.ts
// 10.3 课教学代码：ConfigService--用 Effect Service + Layer 实现依赖注入
//
// 解决的痛点（10.1 课痛点 1-2）：
// - 之前 loadConfig() 每次调用都读一遍 opencode.json，index.ts 和 agent.tsx 各调一次
// - 现在用 ConfigService：Layer 启动时读一次文件并缓存，所有消费者共享同一份
//
// Service 三件套（名字都是我们自己起的，不是 effect 关键字）：
// 1. ConfigServiceApi  -- 声明"这个服务能做什么"（能力清单）
// 2. ConfigService     -- 服务的唯一标识（tag），用 effect 库的 Context.Service 创建
// 3. configLayer       -- 服务的具体实现（"工具管理处"怎么造工具）
//
// effect 库提供的（固定不能改）：Context.Service（造标签）、Layer.effect（造实现）、
// ConfigService.of（Context.Service 自动给类加的静态方法，用来包装实现）

import { Context, Effect, Layer } from "effect"

// Config 的形状：和之前 loadConfig() 返回的一致
export interface Config {
  baseURL: string
  apiKey: string
  modelID: string
}

// ── 1. ConfigServiceApi：声明这个服务能做什么 ────────────────
// 名字我们自己起的，叫什么都行，只要和下面的 Context.Service 对上。
// 只有一个能力：get()，返回 Config（包在 Effect 里，因为可能失败）
export interface ConfigServiceApi {
  readonly get: () => Effect.Effect<Config>
}

// ── 2. ConfigService：创建 tag（唯一标识符）──────────────────
// ConfigService 是我们自己起的类名。
// extends Context.Service<...>()("...") 是 effect 库的固定写法（Context.Service 是库提供的）：
// - <ConfigService, ConfigServiceApi>：第一个是自己（类型自引用），第二个是能力清单
// - ("opencode-from-scratch/Config")：全局唯一 ID，调试时能在日志里看到
export class ConfigService extends Context.Service<ConfigService, ConfigServiceApi>()(
  "opencode-from-scratch/Config",
) {}

// ── 3. configLayer：提供实现 ────────────────────────────────
// configLayer 是我们自己起的变量名。Layer.effect 是 effect 库提供的函数。
// Layer.effect 的函数体**只跑一次**--在 Effect.provide 时执行。
// 所以读文件只发生一次，读到的 config 缓存在 Layer 里，所有消费者共享。
// 这就是"工具管理处"模式：工具造一次，发给所有需要的工人。
export const configLayer = Layer.effect(
  ConfigService,
  Effect.gen(function* () {
    // 读一次 opencode.json（用 Effect.promise 桥接现有的 Bun.file）
    const raw = yield* Effect.promise(async () => {
      return await Bun.file("opencode.json").json()
    })

    // 解析 provider/model（和之前 loadConfig 的逻辑一致）
    // "volcengine-plan/deepseek-v4-flash" 拆成 providerID 和 modelID
    const [providerID, modelID] = raw.model.split("/")
    const provider = raw.provider[providerID]

    // 找不到 provider 就让 Layer 构建失败（程序无法启动，合理）
    // 注：10.7 课会用 typed error 替代这种裸 Error
    if (!provider) {
      return yield* Effect.fail(new Error(`配置文件里找不到 provider: ${providerID}`))
    }

    const config: Config = {
      baseURL: provider.baseURL,
      apiKey: provider.apiKey,
      modelID,
    }

    // ConfigService.of(...) 是 Context.Service 自动给类加的静态方法（不是我们自己写的）
    // 作用：把实现对象包装成服务实例，存进 Context
    // get() 返回 Effect.succeed(config)--因为 config 已经缓存好了，直接给
    return ConfigService.of({
      get: () => Effect.succeed(config),
    })
  }),
)
