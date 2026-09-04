// src/tool/truncate.ts
// 工具输出截断：防止过长的输出撑爆 LLM 上下文
// 对照 opencode: packages/opencode/src/tool/truncate.ts
// opencode 的截断更完善——写临时文件 + LLM 可以 read 完整内容
// 我们简化版：保留开头和结尾，中间省略

// 最大行数和字节数（和 opencode 一样）
const MAX_LINES = 2000
const MAX_BYTES = 50 * 1024 // 50KB

export function truncate(text: string): string {
  const lines = text.split("\n")

  // 1. 行数超限：保留前半 + 后半，中间省略
  // 为什么保留首尾？开头通常是最重要的信息，结尾可能有错误提示
  if (lines.length > MAX_LINES) {
    const half = Math.floor(MAX_LINES / 2)
    const head = lines.slice(0, half)
    const tail = lines.slice(-half)
    return [
      ...head,
      `... (省略 ${lines.length - MAX_LINES} 行) ...`,
      ...tail,
    ].join("\n")
  }

  // 2. 字节数超限：直接截断
  if (text.length > MAX_BYTES) {
    return text.slice(0, MAX_BYTES) + `\n... (输出过长，已截断，共 ${text.length} 字节)`
  }

  return text
}
