// 这个文件是可以直接运行的教学 demo，不使用测试框架。
// 运行：bun run packages/core/src/provider/endpoint-demo.ts
import type { Endpoint } from "./endpoint"
import { renderEndpoint } from "./endpoint"

function runDemo(name: string, endpoint: Endpoint, expected: string) {
  const actual = renderEndpoint(endpoint).toString()

  console.log(`\n--- ${name} ---`)
  console.log("baseURL:", endpoint.baseURL)
  console.log("path:", endpoint.path)
  console.log("完整 URL:", actual)

  if (actual === expected) {
    console.log("结果符合预期")
    return
  }

  throw new Error(`结果不符合预期\n期望: ${expected}\n实际: ${actual}`)
}

runDemo(
  "正常拼接",
  {
    baseURL: "https://api.example.com/v1",
    path: "/chat/completions",
  },
  "https://api.example.com/v1/chat/completions",
)

runDemo(
  "清理重复斜杠",
  {
    baseURL: "https://api.example.com/v1/",
    path: "/chat/completions",
  },
  "https://api.example.com/v1/chat/completions",
)

runDemo(
  "更换路线 path",
  {
    baseURL: "https://api.example.com/v1",
    path: "responses",
  },
  "https://api.example.com/v1/responses",
)

console.log("\n三个 Endpoint demo 均通过")
