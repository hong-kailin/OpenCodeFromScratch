// src/type-error-demo.ts
// 故意写类型错误，演示 tsc 报错格式
// 跑 bun run typecheck 会在终端看到 TS2322 错误
// （本文件已被 tsconfig exclude，正常 typecheck 不会扫到它；
//  想看报错就临时把 exclude 里的 "src/type-error-demo.ts" 删掉再跑）

const num: number = "hello" // 把 string 赋给 number，类型不匹配
