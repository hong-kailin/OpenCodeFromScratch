# 1.1 配置文件模式：像 opencode 一样管理 provider

> 本课目标：理解 opencode 的配置文件模式，设计我们自己的配置文件，把 provider 信息（baseURL/apiKey/model）从代码里抽出来。

## 从你的 opencode 配置说起

你电脑上的 opencode 就是靠这个配置文件跑起来的——[`~/.config/opencode/opencode.json`](https://opencode.ai/docs/config)：

```json
{
  "$schema": "https://opencode.ai/config.json",
  "model": "volcengine-plan/deepseek-v4-flash",
  "provider": {
    "volcengine-plan": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Volcano Engine (Coding Plan)",
      "options": {
        "baseURL": "https://ark.cn-beijing.volces.com/api/coding/v3",
        "apiKey": "ark-9d935004-xxx"
      },
      "models": {
        "deepseek-v4-flash": {
          "name": "deepseek-v4-flash",
          "limit": { "context": 1024000, "output": 4096 }
        }
      }
    }
  }
}
```

这个文件做了三件事：

1. **指定默认模型**：`"model": "volcengine-plan/deepseek-v4-flash"`——用 `providerID/modelID` 格式
2. **定义 provider**：`"provider"` 里写每个 provider 的 baseURL、apiKey、npm 包
3. **声明可用模型**：每个 provider 下列出 models，包含 context/output 限制

opencode 启动时读这个文件，就知道去哪调 API、用什么 key、有哪些模型可选。

## 为什么要用配置文件

你可能会问：直接在代码里写 `baseURL` 和 `apiKey` 不就行了？为什么要搞个配置文件？

因为**配置和代码要分离**。想想你用 Python 时的场景：

```python
# 烂写法：硬编码
api_key = "sk-xxx"
base_url = "https://api.openai.com/v1"

# 好写法：从环境变量/配置文件读
api_key = os.environ["OPENAI_API_KEY"]
```

opencode 把这个思路更进一步——不只是 apiKey，连 baseURL、模型列表、provider 名都放配置文件里。好处：

1. **换 provider 不改代码**：今天用火山引擎，明天换 OpenAI，只改配置文件
2. **多 provider 共存**：配置文件里写多个 provider，运行时选一个用
3. **不泄露密钥**：apiKey 在配置文件里（可以 gitignore），不进代码仓库
4. **团队共享配置**：配置文件就是 provider 的说明书，新人一看就知道用什么

> 类比 Python：这就像 `django settings.py` 或 `config.yaml`——把"会变的东西"和"代码逻辑"分开。

## `provider/model` 格式

配置里 `"model": "volcengine-plan/deepseek-v4-flash"` 这个格式是关键：

```
volcengine-plan / deepseek-v4-flash
└─ providerID ──┘  └─ modelID ──────┘
```

- **providerID**（`volcengine-plan`）：对应 `provider` 对象里的 key，找到 baseURL 和 apiKey
- **modelID**（`deepseek-v4-flash`）：对应 `models` 对象里的 key，找到模型的具体参数

opencode 解析这个字符串的代码在 `provider/provider.ts`——拆分成 providerID 和 modelID，分别查 provider 配置和 model 配置。

> 这个 `provider/model` 格式是 opencode 的约定。我们在代码里也会实现这个解析。

## 对照 opencode：配置怎么被加载的

opencode 加载配置的流程（简化版）：

```
启动
 │
 ▼
找配置文件：~/.config/opencode/opencode.json（或 .jsonc）
 │
 ▼
解析 JSON（支持注释和尾逗号，用 jsonc-parser）
 │
 ▼
用 Schema 校验（每个字段都有类型定义）
 │
 ▼
存到内存里，运行时查 provider/model
```

关键源码位置：

- **找配置文件**：`opencode/packages/opencode/src/config/config.ts:139`——按 `opencode.jsonc` → `opencode.json` → `config.json` 顺序找
- **provider 配置类型**：`opencode/packages/core/src/v1/config/provider.ts:76`——定义了 `npm`、`options.baseURL`、`options.apiKey`、`models` 等字段
- **`@ai-sdk/openai-compatible` 实例化**：`opencode/packages/opencode/src/provider/provider.ts:1739`——用 `createOpenAICompatible({ name, baseURL, apiKey })` 创建 provider 实例

> opencode 实际加载配置时还支持项目级配置（`./opencode.json`）、环境变量覆盖、远程配置等，层次很复杂。我们简化版只做全局配置文件。

## 设计我们的配置文件

我们模仿 opencode 的模式，设计一个简化版的配置文件。创建 [`opencode.json`](../../../opencode.json)：

```json
{
  "model": "volcengine-plan/deepseek-v4-flash",
  "provider": {
    "volcengine-plan": {
      "name": "Volcano Engine (Coding Plan)",
      "baseURL": "https://ark.cn-beijing.volces.com/api/coding/v3",
      "apiKey": "你的apiKey",
      "models": {
        "deepseek-v4-flash": {},
        "glm-5.2": {},
        "doubao-seed-2.0-code": {}
      }
    }
  }
}
```

和 opencode 的区别（简化点）：

| | opencode | 我们的 |
|---|----------|--------|
| `npm` 字段 | 有（指定 `@ai-sdk/*` 包） | 没有（我们裸 fetch，不用 SDK） |
| `options.baseURL` | 嵌套在 options 里 | 直接放顶层（简化） |
| `options.apiKey` | 嵌套在 options 里 | 直接放顶层（简化） |
| models 的 limit/modalities | 有 | 暂时留空（后续阶段再加） |

> 这些简化是有意的——我们先用最简结构跑通，后续阶段再逐步补全到和 opencode 一致。最终目标是 1:1 复刻。

## 把配置文件加入 .gitignore

**重要**：`opencode.json` 里有 apiKey，不能提交到 git！先加到 `.gitignore`。

但这里有个矛盾——配置文件结构是共享的（团队都要知道格式），但 apiKey 是私密的。opencode 的做法是：

- 配置文件本身不提交（`.gitignore` 忽略 `opencode.json`）
- 但提供 `$schema` 字段指向 JSON Schema，编辑器能自动补全和校验

我们也这么做：`opencode.json` 加入 `.gitignore`，后续可以提供一个 `opencode.example.json` 作为模板。

## 本课小结

你学会了：

1. **opencode 的配置模式**：provider 信息（baseURL/apiKey/models）写在 JSON 配置文件里，不在代码里
2. **`provider/model` 格式**：`volcengine-plan/deepseek-v4-flash` 拆分成 providerID 和 modelID
3. **为什么要配置文件**：换 provider 不改代码、多 provider 共存、不泄露密钥
4. **opencode 怎么加载配置**：找文件 → 解析 JSON → Schema 校验 → 运行时查
5. **我们的简化版配置**：去掉 `npm`/`options` 嵌套，后续阶段再补全

下一步：[1.2 messages 结构与 curl 实操](../02-messages-curl/01-messages-curl.md) —— 用配置文件里的信息，手动调一次 API。
