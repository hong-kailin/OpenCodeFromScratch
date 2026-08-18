# 10.1 感受痛点：依赖到处传

> 本课不写代码，只让痛点可见。建立"我们需要依赖注入"的动机。

## 盘点当前代码的问题

打开 `src/index.ts`（CLI 入口）和 `src/tui/agent.tsx`（TUI 入口），你会发现以下代码**各重复了一份**：

### 重复 1：loadConfig()

```typescript
// src/index.ts 里
const config = await loadConfig()

// src/tui/agent.tsx 里
const config = await loadConfig()
```

两个文件都各自读一遍 `opencode.json`。如果以后加第三个入口（比如 Web UI），又得再读一次。

### 重复 2：createOpenAIProvider(config)

```typescript
// src/index.ts 里
const provider = createOpenAIProvider(config)

// src/tui/agent.tsx 里
const provider = createOpenAIProvider(config)
```

### 重复 3：tools 数组

```typescript
// src/index.ts 里
const tools = [readTool, writeTool, editTool, bashTool, globTool, grepTool]

// src/tui/agent.tsx 里
const tools = [readTool, writeTool, editTool, bashTool, globTool, grepTool]
```

### 重复 4：runToolLoop / runAgentLoop

两个循环逻辑几乎一样，只是持久化方式不同（CLI 存 DB，TUI 不存）。

## 实操验证：加第 7 个工具

假设你要加一个 `webfetch` 工具。需要改哪些地方？

1. `src/tool/webfetch.ts` —— 实现工具
2. `src/index.ts` —— 加到 tools 数组
3. `src/tui/agent.tsx` —— 加到 tools 数组

**改 3 处。** 漏改一处，CLI 和 TUI 的能力就不一致。

## 根因：没有"全局注册点"

config、provider、tools 这些"整个应用共享的东西"没有一个统一的地方构造和分发。每个入口各自造一份，导致：

- 重复代码
- 不一致风险（漏改一处就出 bug）
- 参数层层传递（`runToolLoop(messages, sessionId, provider, tools)` 越加越多）

## 解法：依赖注入（DI）

依赖注入的核心思想：**让依赖"按需自取"，而非"层层传递"**。

Python 类比：
- FastAPI 的 `Depends()` —— 路由函数声明"我需要数据库连接"，框架自动注入
- Flask 的 `current_app` —— 不用传 app 参数，直接 import 就能拿到

在 TypeScript 世界里，Effect-TS 的 **Service + Layer** 就是干这个的：
- **Service**：声明"我需要什么"（比如"我需要 Config"）
- **Layer**：提供"怎么造"（比如"读 opencode.json 造 Config"）
- 运行时，Effect 框架自动把 Layer 造好的实例挂到 Context，Service 从 Context 自取

## 下一步

10.2 课开始学 Effect 的最基本概念——在学 Service/Layer 之前，先理解"Effect 是什么"。