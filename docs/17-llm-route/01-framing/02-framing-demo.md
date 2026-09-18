# 17.1 补充：如何运行和读懂 Framing demo

> 对照代码：[framing-demo.ts](../../../packages/core/src/provider/framing-demo.ts)

这一份只解释 demo 的 TypeScript 写法。它不是自动化测试文件，不需要先学习测试框架。
可以把它理解成一份带结果检查的 Python 演示脚本。

## 先直接运行

在项目根目录执行：

```bash
bun run packages/core/src/provider/framing-demo.ts
```

`bun run` 在这里相当于 `python demo.py`：Bun 读取 `.ts` 文件，去掉类型信息并执行代码。
预期输出的关键部分是：

```text
--- JSON 跨 chunk ---
Framing 输出: [ "{\"choices\":[{\"delta\":{\"content\":\"你好\"}}]}" ]
结果符合预期

--- UTF-8 字符跨 chunk ---
Framing 输出: [ "{\"text\":\"你\"}" ]
结果符合预期

两个 Framing demo 均通过
```

如果结果不符合预期，程序会抛出 Error 并以非零状态结束，所以它也能帮助我们发现回归；这里只用
普通控制流表达检查过程，暂时不引入测试框架的组织方式。

## 第一部分：导入与类型

```ts
import { Effect, Stream } from "effect"
import type { LLMError } from "../error/errors"
import { sseFraming } from "./framing"
```

普通 `import` 会在运行时加载值。`import type` 只给 TypeScript 类型检查器使用，执行前会被删除，
类似 Python 把仅供 type checker 使用的导入放进 `if TYPE_CHECKING:`。

```ts
function byteStream(chunks: Uint8Array[]): Stream.Stream<Uint8Array, LLMError> {
  return Stream.fromIterable(chunks)
}
```

这段签名可以从内向外读：

- `chunks: Uint8Array[]`：参数是字节数组的数组，类似 Python 的 `list[bytes]`；
- `Stream.Stream<Uint8Array, LLMError>`：返回的 Stream 每次产出 `Uint8Array`，失败类型是 `LLMError`；
- `Stream.fromIterable(chunks)`：把普通数组包装成惰性的 Stream。

数组本身不会失败，所以实际错误类型是 TypeScript 的 `never`。`never` 表示“不可能出现的值”，
可以安全放到要求 `LLMError` 的位置。

## 第二部分：把字符串变成网络字节

```ts
const encoder = new TextEncoder()

const chunks = [
  encoder.encode('data: {"choices":[{"del'),
  encoder.encode('ta":{"content":"你'),
  encoder.encode('好"}}]}\n\n'),
]
```

`const` 表示变量绑定不会重新赋值，类似 Python 里约定不再改名的局部变量。`TextEncoder.encode()`
把 JavaScript 字符串编码成 UTF-8 `Uint8Array`。我们故意在 JSON 中间分成三个数组，用它模拟三次
网络读取；这比等待真实网络碰巧这样切块更稳定。

## 第三部分：真正执行 Effect Stream

```ts
const frames = await Effect.runPromise(
  sseFraming.frame(byteStream(chunks)).pipe(Stream.runCollect),
)
```

这一段分三层：

1. `byteStream(chunks)` 得到模拟的网络字节流；
2. `sseFraming.frame(...)` 描述“字节流变成完整 frame”；
3. `Stream.runCollect` 收集所有 frame，`Effect.runPromise` 才真正执行，并让 `await` 等待结果。

前两层只是惰性描述。它类似先构造 async generator，再由事件循环真正消费。

## 第四部分：检查输出

```ts
function assertFrames(actual: string[], expected: string[]) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) return
  throw new Error(
    `结果不符合预期\n期望: ${JSON.stringify(expected)}\n实际: ${JSON.stringify(actual)}`,
  )
}
```

JavaScript 的数组是对象，`actual === expected` 比较两边是不是同一个对象，不会逐项比较内容。
这里的数组只包含字符串，所以先 `JSON.stringify` 再比较就足够。不同则抛错；相同就 early return。

文件底部直接使用 `await runDemo(...)`。项目采用 ESM，Bun 支持 top-level await，因此不需要再包一层
`main()`；如果类比 Python，它完成的是 `asyncio.run(main())` 启动异步程序的工作。

这个 demo 让输入边界和执行过程都能直接看到。以后正式学习 TypeScript 测试时，再把相同场景迁移
到 `bun:test`，届时测试框架只负责自动发现、分组和报告，不会改变 Framing 本身的输入与输出。
