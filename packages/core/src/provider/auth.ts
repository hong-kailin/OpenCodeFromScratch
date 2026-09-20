// Auth 只负责“怎样把身份信息应用到一次请求”。
// 它不知道请求发往哪个 URL，不构造 body，也不解析响应。
//
// 对照 opencode: packages/llm/src/route/auth.ts

// 当前只有同步的 Bearer API key，所以先使用最小输入：已有 Headers。
// 真实 opencode 的 Auth 还会看到 method、URL 和 body，以支持 AWS SigV4；
// 也支持 Effect、凭据回退和组合。等对应需求出现时再逐步演进。
export interface Auth {
  readonly apply: (headers: Headers) => Headers
}

// Bearer Auth 不直接修改调用者传入的 Headers，而是复制一份再添加认证。
// 这样同一份基础 headers 可以安全地交给不同 Auth，不会相互污染。
export function bearerAuth(token: string): Auth {
  return {
    apply: (headers) => {
      const authenticated = new Headers(headers)
      authenticated.set("Authorization", `Bearer ${token}`)
      return authenticated
    },
  }
}
