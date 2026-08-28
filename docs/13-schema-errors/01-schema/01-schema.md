# 13.1 Schema 基础：声明式数据契约

> 对照代码：`src/schema-demo.ts` 第 1-2 节

## 当前问题：裸 JSON.parse

agent loop 里工具参数解析是这样的：

```typescript
const args = JSON.parse(tc.function.arguments)
// args 类型是 any——没有任何校验！
// LLM 返回错误参数时，静默失败或运行时崩溃
```

## Schema 的解法：双重身份

Schema 定义一次，同时获得两样东西：

```
编译期：TS 类型（type User = typeof UserSchema.Type）
运行期：校验器（Schema.decodeUnknownSync(UserSchema)(input)）
```

不需要手动写 `interface` + 手动写校验逻辑。

## 基础用法

```typescript
import { Schema } from "effect"

// 定义
const UserSchema = Schema.Struct({
  name: Schema.String,
  age: Schema.Number,
})

// 类型推导（编译期）
// 作用：当你想把 User 类型用在函数签名、泛型参数等地方时，
// 不用手动写 interface User，直接从 Schema 推导——定义一次，类型自动有
type User = typeof UserSchema.Type  // { name: string; age: number }

// 实际使用场景：一个函数只接受"已校验的 User"
function greet(user: User) {
  console.log(`你好, ${user.name}, 你 ${user.age} 岁了`)
}

// 运行时校验：校验通过后，user 就是 User 类型，可以直接传给 greet
const user = Schema.decodeUnknownSync(UserSchema)({ name: "Alice", age: 30 })
greet(user)  // TS 类型检查通过：确认 user 是 User

// 非法输入会抛 ParseError
Schema.decodeUnknownSync(UserSchema)({ name: "Bob", age: "三十" })
// → ParseError: Expected number, got "三十"
```

> 一句话：`typeof Schema.Type` 不是每次都要写。只有当函数签名、类型标注需要"这个 Schema 对应的类型"时才用它——否则直接让 TS 从 `decodeUnknownSync` 的返回值自动推断即可。

## 对照 Python

| Effect Schema | Python |
|---|---|
| `Schema.Struct({...})` | `pydantic.BaseModel` |
| `decodeUnknownSync` | `model_validate()` |
| `typeof Schema.Type` | `model.__fields__` |

## 跑一下

```bash
bun run src/schema-demo.ts
```

看第 1-2 节的输出。