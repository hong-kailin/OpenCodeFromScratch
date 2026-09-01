// src/json-schema-demo.ts
// 阶段 13.3 教学代码：toJSONSchema 到底在做什么
// 跑法：bun run src/json-schema-demo.ts
//
// 解决一个问题：工具参数有三份信息（类型 / 校验器 / 给 LLM 的 JSON Schema），
// 手写三份容易不一致。toJSONSchema 让"给 LLM 的 JSON Schema"从同一份 Schema 自动生成。
//
// 本 demo 分四节：
//   1. 阶段 13 之前：一份参数，三份手写 —— 用【真实可执行】的手写版工具跑出行为差异
//   2. 现在第 1 步：Schema.toJsonSchemaDocument —— Effect Schema → JSON Schema 文档
//   3. 现在第 2 步：normalize —— 清洗 optional 字段的 anyOf 噪音
//   4. 终极目标：工具里只有一份 Parameters 定义，三种东西自动派生

import { Schema } from "effect"

// ── 0. 一份 Effect Schema（唯一的信息来源）────────────────────
// read 工具：只需要 filePath（必填字符串）
const ReadParameters = Schema.Struct({
  filePath: Schema.String.annotate({ description: "要读取的文件路径" }),
})

// edit 工具：多了 replaceAll（可选布尔）——用来展示 optional 的噪音
const EditParameters = Schema.Struct({
  filePath: Schema.String.annotate({ description: "文件路径" }),
  oldString: Schema.String.annotate({ description: "要替换的原文" }),
  newString: Schema.String.annotate({ description: "替换后的新文本" }),
  replaceAll: Schema.optional(Schema.Boolean).annotate({
    description: "是否替换所有匹配（默认 false）",
  }),
})

// ═══════════════════════════════════════════════════════════════
// 1. 阶段 13 之前：一份参数，三份手写（真实可执行）
// ═══════════════════════════════════════════════════════════════
//
// 先看手写版工具长什么样——它真的有"三份"：一份类型、一份 execute 里的取值、
// 一份 JSON Schema。然后我们用真实输入跑它，看"三份没同步"会出什么问题。
console.log("════════ 1. 阶段 13 之前：一份参数，三份手写 ════════\n")

// ── 份 1：类型（写给编译器看的）─────────────────────────────
// 手写版 execute 的签名。Record<string, unknown> 太宽泛：
// 任何对象都满足它，等于没约束，无法表达"必须有 filePath 且是字符串"。
type HandWrittenArgs = Record<string, unknown>

// ── 份 2：execute 函数体里的取值（运行期真正用的逻辑）────────
// 这里用 as 断言"取"参数。as 断言不是校验——它只是对编译器说
// "别管我，我确定它是 string"。运行期没有任何检查！
async function handWrittenRead(args: HandWrittenArgs): Promise<string> {
  // 手写版：直接断言取值，没有校验
  // ⚠️ 关键：as string 只改编译器的"理解"，不做运行期转换！
  //    如果 args.filePath 运行期是 123（number），filePath 仍然是 123（number），
  //    不是 "123"。要真转换得用 String(x) / x.toString()。
  //    类比 Python: typing.cast(int, x)——纯编译期，不碰值。
  const filePath = args.filePath as string

  // 真实逻辑：读文件 + 加行号（和 src/tool/read.ts 一致）
  const file = Bun.file(filePath)
  const exists = await file.exists()
  if (!exists) return `错误：文件 ${filePath} 不存在`

  const text = await file.text()
  const numbered = text.split("\n").map((line, i) => `${i + 1}: ${line}`).join("\n")
  return `${filePath}\n<type>file</type>\n<content>\n${numbered}\n</content>`
}

// ── 份 3：JSON Schema（写给 LLM 看的）────────────────────────
// 手写第三份，描述"LLM 你调用 read 时要传 filePath，字符串"。
// 注意：这只是"告诉 LLM"，它约束不了运行期——LLM 真传错时份3 拦不住。
const handWrittenReadParameters = {
  type: "object",
  properties: {
    filePath: {
      type: "string",
      description: "要读取的文件路径",
    },
  },
  required: ["filePath"],
}

// ── 模拟 agent-loop：把 LLM 返回的 arguments 喂给手写版工具 ──
// 手写版 agent-loop 的解析逻辑：JSON.parse + 直接 execute（无校验）
async function dispatchHandWritten(argumentsJson: string): Promise<string> {
  const args = JSON.parse(argumentsJson) // any，无校验
  return handWrittenRead(args)
}

console.log("【手写版 read 工具的三份】")
console.log("  份1 类型    : execute(args: Record<string, unknown>)  ← 太宽泛")
console.log("  份2 取值    : const filePath = args.filePath as string  ← as 断言，不是校验")
console.log("  份3 JSON Schema（下面打印）：")
console.log(JSON.stringify(handWrittenReadParameters, null, 2))
console.log("")

// ═══ 真实执行 1：LLM 正常传参 → 成功 ═══
console.log("── 真实执行 1：LLM 正常传参（filePath 是字符串）──")
const okResult = await dispatchHandWritten('{"filePath": "src/json-schema-demo.ts"}')
console.log("  结果:", okResult.split("\n").slice(0, 3).join("\n").replace(/\n/g, "\n  "), "…")
console.log("")

// ═══ 真实执行 2：LLM 传错类型（filePath 是数字）→ 三份没同步的后果 ═══
// 分 3 明明写了 "type": "string"，但运行期它管不住。
// 份 2 用 as 断言硬转，把 123 当成 string 传给 Bun.file。
// 结果：读到的内容是数字 123 的"路径"——文件不存在，返回误导性错误。
console.log("── 真实执行 2：LLM 传错类型（filePath 是数字 123）──")
console.log("  JSON Schema 说 type: string，但运行期没人拦")
const wrongTypeResult = await dispatchHandWritten('{"filePath": 123}')
console.log("  结果:", wrongTypeResult)
console.log("  ↑ 明明传错类型，却得到'文件不存在'——错误信息误导人！")
console.log("  ↑ 注意：这里'123'是 Bun.file 内部把数字转成路径字符串的结果，")
console.log("    不是 as string 做的——as 从不做运行期转换，filePath 运行期还是数字")
console.log("  （如果参数里混了字符串操作，比如 .replace()，会直接运行期崩溃）")
console.log("")

// ═══ 真实执行 3：给 read 加 offset 参数，只改两处漏一处 ═══
// 现在想给 read 加一个可选参数 offset（从第几行开始读）。
// 开发改了 份3（JSON Schema 告诉 LLM）+ 份1（签名是 Record 无所谓），
// 但 份2（execute 函数体）忘了读 args.offset！
console.log("── 真实执行 3：加 offset 参数，份2 漏改 → 静默失效 ──")

// 份3 改好了：JSON Schema 告诉 LLM 可以传 offset
const updatedJSONSchema = {
  ...handWrittenReadParameters,
  properties: {
    filePath: { type: "string", description: "要读取的文件路径" },
    offset: { type: "number", description: "从第几行开始读（可选）" },
  },
}
console.log("  份3 改了：JSON Schema 新增 offset =", JSON.stringify(updatedJSONSchema.properties.offset))

// 但份2（handWrittenRead 函数体）没有读 offset 的逻辑！
// LLM 看到 JSON Schema 后，很守规矩地传了 offset: 3
const offsetResult = await dispatchHandWritten('{"filePath": "src/json-schema-demo.ts", "offset": 3}')
console.log("  LLM 传参: {\"filePath\": \"...\", \"offset\": 3}")
console.log("  份2 execute 读了 offset 吗？没有——函数体里压根没这行代码")
console.log("  结果（前 4 行，offset=3 应该从第 3 行开始）：")
console.log("  ", offsetResult.split("\n").slice(0, 4).join("\n  "))
console.log("  ↑ 用户要的'从第 3 行读'被静默丢弃，且没有任何报错！")
console.log("  ↑ 这就是'改了 A 忘了 B 就乱套'——三处手写无法保证同步\n")

// ═══════════════════════════════════════════════════════════════
// 2. 现在第 1 步：Schema.toJsonSchemaDocument
// ═══════════════════════════════════════════════════════════════
console.log("════════ 2. 现在第 1 步：Schema.toJsonSchemaDocument ════════\n")
// effect 内置转换器：Effect Schema → JSON Schema 文档。
// 类比 Python：pydantic 的 BaseModel.model_json_schema()——定义一份模型，JSON Schema 白送。
const doc = Schema.toJsonSchemaDocument(ReadParameters, { additionalProperties: true })
console.log("doc 结构: { dialect, schema, definitions }")
console.log("doc.schema =")
console.log(JSON.stringify(doc.schema, null, 2))
console.log("↑ 和第 1 节的份3 一模一样——但这是从 ReadParameters 自动生成的！")

// ═══════════════════════════════════════════════════════════════
// 3. 现在第 2 步：normalize 清洗噪音
// ═══════════════════════════════════════════════════════════════
console.log("\n════════ 3. 现在第 2 步：normalize 清洗噪音 ════════")
// 先看噪音从哪来：optional 字段（replaceAll）会生成 anyOf: [boolean, null]
const rawEditDoc = Schema.toJsonSchemaDocument(EditParameters, { additionalProperties: true })
console.log("【清洗前】edit 的 replaceAll 字段：")
const replaceAllField = (rawEditDoc.schema as Record<string, any>).properties.replaceAll
console.log(JSON.stringify(replaceAllField, null, 2))
console.log("      ↑ anyOf 里塞了个 null 分支，LLM 看了会困惑（'我该传 true/false 还是 null？'）")

// 清洗规则（见 src/tool/tool.ts 的 normalize）：
//   1. anyOf 里去掉 null 分支
//   2. 只剩一个分支 → 展开成普通字段（丢掉 anyOf 包装）
//   3. 嵌套的 anyOf 递归处理
function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize)
  if (typeof value !== "object" || value === null) return value

  const record = value as Record<string, unknown>
  if (Array.isArray(record.anyOf)) {
    const branches = (record.anyOf as unknown[]).filter(
      (sub) => !(typeof sub === "object" && sub !== null && (sub as Record<string, unknown>).type === "null"),
    )
    if (branches.length === 1) {
      const { anyOf: _, ...rest } = record
      return normalize({ ...rest, ...(branches[0] as Record<string, unknown>) })
    }
    if (branches.length > 0) {
      const { anyOf, ...rest } = record
      return normalize({ ...rest, anyOf: normalize(branches) })
    }
  }
  const result: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(record)) {
    result[key] = normalize(item)
  }
  return result
}

console.log("\n【清洗后】edit 的参数（给 LLM 看的最终版）：")
console.log(JSON.stringify(normalize(rawEditDoc.schema), null, 2))
console.log("      ↑ replaceAll 变成干净的 boolean，description 也保住了")
console.log("      ↑ 可选字段靠'不进 required'表达可选，不再需要 null 分支")

// ═══════════════════════════════════════════════════════════════
// 4. 终极目标：一份定义，三种用途自动派生
// ═══════════════════════════════════════════════════════════════
console.log("\n════════ 4. 终极目标：一份定义，三种用途自动派生 ════════")
console.log("工具文件里只写这一份 Parameters：")
console.log("  export const Parameters = Schema.Struct({ filePath: Schema.String })")
console.log("然后：")
console.log("  · 类型（编译期）    : Schema.Schema.Type<typeof Parameters>")
console.log("  · 校验器（运行期）  : Schema.decodeUnknownEffect(Parameters)")
console.log("  · JSON Schema（LLM）: toJSONSchema(Parameters)")
console.log("三样东西从同一份定义派生，改一处三处同步——这就是'单一来源'")
console.log("对比第 1 节：一个事实三处手写 → 现在一个事实一处定义三处派生")
