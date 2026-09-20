// 这个文件是可以直接运行的教学 demo，不使用测试框架。
// 运行：bun run packages/core/src/provider/framing-demo.ts
import { Effect, Stream } from "effect"
import type { LLMError } from "../error/errors"
import { sseFraming } from "./framing"

const encoder = new TextEncoder()

// 固定同一组输入，先交给旧管线观察失败，再交给正确的 SSE Framing 对照。
// 这三个数组模拟网络分三次交付同一个 SSE 事件。注意：chunk 边界故意落在
// JSON 内容中间，而不是落在换行处。
const jsonChunks = [
  encoder.encode('data: {"choices":[{"del'),
  encoder.encode('ta":{"content":"你'),
  encoder.encode('好"}}]}\n\n'),
]

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

// 复现阶段 14 旧代码的关键行为：每收到一个网络 chunk，就立刻 decode、
// split("\n")，然后把以 "data: " 开头的内容交给 JSON.parse。
//
// 这段函数故意保留错误实现，只用于观察 bug，生产代码不会调用它。
function demonstrateBrokenChunkSplitting(chunks: Uint8Array[]) {
  console.log("\n=== 先复现旧管线的问题 ===")
  const decoder = new TextDecoder()
  let sawParseError = false

  chunks.forEach((chunk, index) => {
    const text = decoder.decode(chunk, { stream: true })
    const lines = text.split("\n")

    console.log(`\n收到 chunk ${index + 1}:`)
    console.log("decode 后:", JSON.stringify(text))
    console.log('split("\\n") 后:', lines.map((line) => JSON.stringify(line)))

    lines
      .filter((line) => line.startsWith("data: "))
      .forEach((line) => {
        const payload = line.slice("data: ".length)
        console.log("送进 JSON.parse:", JSON.stringify(payload))

        try {
          JSON.parse(payload)
          console.log("JSON.parse 成功")
        } catch (error) {
          sawParseError = true
          console.log("JSON.parse 失败:", error instanceof Error ? error.message : String(error))
        }
      })
  })

  // flush TextDecoder 内部可能残留的 UTF-8 字节。这里不会补回被 split 后丢掉的
  // 半行，因为 TextDecoder 只保存不完整字符，不保存 SSE 行或 JSON。
  decoder.decode()

  if (!sawParseError) {
    throw new Error("旧管线复现失败：预期看到 JSON.parse 报错")
  }

  console.log("\n结论：chunk 1 的半截 JSON 被过早解析；chunk 2、3 又因为不以 data: 开头而被丢弃。")
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

// 先让错误实现处理同一组 chunk，直接观察它在哪一步破坏了 SSE 事件。
demonstrateBrokenChunkSplitting(jsonChunks)

// 场景一：正确的 Framing 会跨 chunk 保存半行和半个事件，直到收到空行。
await runDemo(
  "正确 Framing：JSON 跨 chunk",
  jsonChunks,
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

console.log("\n旧问题已复现，两个正确 Framing demo 均通过")
