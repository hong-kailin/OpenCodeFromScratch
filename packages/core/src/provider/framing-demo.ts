// 这个文件是可以直接运行的教学 demo，不使用测试框架。
// 运行：bun run packages/core/src/provider/framing-demo.ts
import { Effect, Stream } from "effect"
import type { LLMError } from "../error/errors"
import { sseFraming } from "./framing"

const encoder = new TextEncoder()

// 把我们准备好的字节块包装成 Effect Stream，模拟 HTTP body 一块块到达。
// 这里没有真实网络，所以 Stream 不会失败；never 可以安全地用在 LLMError 的位置。
function byteStream(chunks: Uint8Array[]): Stream.Stream<Uint8Array, LLMError> {
  return Stream.fromIterable(chunks)
}

// JSON.stringify 让数组按内容比较。JavaScript 中 expected === actual 比较的是
// 数组对象是否为同一个对象，不能用来判断两个数组里的字符串是否相同。
function assertFrames(actual: string[], expected: string[]) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) return

  throw new Error(
    `结果不符合预期\n期望: ${JSON.stringify(expected)}\n实际: ${JSON.stringify(actual)}`,
  )
}

async function runDemo(name: string, chunks: Uint8Array[], expected: string[]) {
  console.log(`\n--- ${name} ---`)
  console.log("输入 chunk 长度:", chunks.map((chunk) => chunk.length))

  // Effect Stream 是惰性的。Stream.runCollect 描述“收集全部输出”，
  // Effect.runPromise 才真正执行它，并把结果交还给普通 async/await 代码。
  const frames = await Effect.runPromise(
    sseFraming.frame(byteStream(chunks)).pipe(Stream.runCollect),
  )

  console.log("Framing 输出:", frames)
  assertFrames(frames, expected)
  console.log("结果符合预期")
}

// 场景一：一条 JSON 被网络拆成三个 chunk。
await runDemo(
  "JSON 跨 chunk",
  [
    encoder.encode('data: {"choices":[{"del'),
    encoder.encode('ta":{"content":"你'),
    encoder.encode('好"}}]}\n\n'),
  ],
  ['{"choices":[{"delta":{"content":"你好"}}]}'],
)

// 场景二：故意从“你”的三个 UTF-8 字节中间切开。
const allBytes = encoder.encode('data: {"text":"你"}\n\ndata: [DONE]\n\n')
const chineseStart = allBytes.findIndex((byte) => byte === 0xe4)

await runDemo(
  "UTF-8 字符跨 chunk",
  [allBytes.slice(0, chineseStart + 1), allBytes.slice(chineseStart + 1)],
  ['{"text":"你"}'],
)

console.log("\n两个 Framing demo 均通过")
