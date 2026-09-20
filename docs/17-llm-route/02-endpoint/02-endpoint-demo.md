# 17.2 补充：读懂 Endpoint demo

> 对照代码：[endpoint-demo.ts](../../../packages/core/src/provider/endpoint-demo.ts)

这个 demo 是普通 TypeScript 程序，不使用测试框架。它构造三份 Endpoint，打印渲染结果，并在结果
不符合预期时抛出 Error。

## 直接运行

```bash
bun run packages/core/src/provider/endpoint-demo.ts
```

三个场景分别回答：正常配置怎样拼接、尾部多写 `/` 会怎样、换一条 path 是否需要修改渲染函数。

## `import type` 与普通 `import`

```ts
import type { Endpoint } from "./endpoint"
import { renderEndpoint } from "./endpoint"
```

`Endpoint` 只在类型标注中出现，使用 `import type`，编译后会被删除；`renderEndpoint` 是运行时真正
调用的函数，必须普通导入。Python 中可以把前者类比成放在 `if TYPE_CHECKING:` 里的导入。

## 函数签名怎么读

```ts
function runDemo(name: string, endpoint: Endpoint, expected: string) {
```

冒号右边是参数类型：`name` 和 `expected` 必须是字符串，`endpoint` 必须满足 Endpoint 的字段要求。
函数没有写返回类型，TypeScript 会从所有分支推断它返回 `void`，也就是只做事、不返回结果。

## `URL` 为什么又变回字符串

```ts
const actual = renderEndpoint(endpoint).toString()
```

项目代码把 `URL` 对象直接传给 `fetch`。demo 调用 `.toString()`，是为了方便打印并与预期字符串
比较。这里没有改变 URL，只是取得它的文本表示。

## 三元表达式与正则

真正的渲染逻辑在 `endpoint.ts`：

```ts
const baseURL = endpoint.baseURL.replace(/\/+$/, "")
const path = endpoint.path.startsWith("/") ? endpoint.path : `/${endpoint.path}`
```

`/\/+$/` 是 JavaScript 正则字面量：转义后的 `\/` 匹配斜杠，`+` 表示一个或多个，`$` 表示字符串
末尾；`replace(..., "")` 会删除末尾全部斜杠。

第二行是三元表达式，等价于 Python 的：

```python
path = endpoint.path if endpoint.path.startswith("/") else f"/{endpoint.path}"
```

项目约定优先用三元表达式表达这种“根据条件选择一个值”的逻辑，避免先声明可变变量再用 `if`
修改它。

## 为什么成功分支使用 early return

```ts
if (actual === expected) {
  console.log("结果符合预期")
  return
}

throw new Error(...)
```

结果正确时立即返回，后面的代码只处理错误路径。这样不需要 `else`，阅读时也能快速看到正常路径
在哪里结束。`===` 在这里比较两个字符串的值，因此不需要像数组 demo 那样先 `JSON.stringify`。

## 三个场景怎样保护这个边界

| 场景 | 输入差异 | 要证明的行为 |
|---|---|---|
| 正常拼接 | baseURL 无尾部 `/` | baseURL 与 path 正常连接 |
| 清理重复斜杠 | baseURL 有尾部 `/` | 输出与正常配置完全相同 |
| 更换路线 path | path 改为 `responses` 且没有开头 `/` | 渲染器补 `/`，其他逻辑不用改 |

demo 不访问网络。只要它失败，问题就位于 Endpoint 输入或 URL 渲染，不需要排查认证、请求 body、
模型服务和 SSE 响应。这正是把职责拆成独立边界后带来的调试收益。
