// 这个文件是可以直接运行的教学 demo，不使用测试框架。
// 运行：bun run packages/core/src/provider/auth-demo.ts
import { bearerAuth } from "./auth"

const baseHeaders = new Headers({
  "Content-Type": "application/json",
})

const auth = bearerAuth("demo-token")
const authenticatedHeaders = auth.apply(baseHeaders)

console.log("应用 Auth 前:")
console.log("  Content-Type:", baseHeaders.get("Content-Type"))
console.log("  Authorization:", baseHeaders.get("Authorization"))

console.log("\n应用 Auth 后:")
console.log("  Content-Type:", authenticatedHeaders.get("Content-Type"))
console.log("  Authorization:", authenticatedHeaders.get("Authorization"))

if (baseHeaders.get("Authorization") !== null) {
  throw new Error("Bearer Auth 修改了原始 Headers")
}

if (authenticatedHeaders.get("Content-Type") !== "application/json") {
  throw new Error("Bearer Auth 丢失了原有 Content-Type")
}

if (authenticatedHeaders.get("Authorization") !== "Bearer demo-token") {
  throw new Error("Bearer Auth 没有生成正确的 Authorization header")
}

console.log("\nBearer Auth demo 通过")
