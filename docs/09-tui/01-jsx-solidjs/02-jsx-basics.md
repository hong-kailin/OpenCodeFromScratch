# 9.1 JSX 语法基础

> 本课目标：学会 JSX 语法--在 TypeScript 里写 UI 标签。不是字符串，是真正的语法。

## JSX 是什么

JSX 是 JavaScript/TypeScript 的语法扩展，让你在代码里直接写 **XML 风格的标签**，用来描述 UI 结构。

你可能觉得"在代码里写标签"很奇怪。先看个例子感受一下：

```tsx
// 这不是字符串，是 JSX 语法
const greeting = <text color="green">你好</text>
```

`<text color="green">你好</text>` 不是字符串（没有引号包裹），是 JSX 标签。TypeScript 编译器会把它转成函数调用，最终等价于类似这样的代码：

```ts
// 简化示意：JSX 标签会被编译成函数调用
// 实际编译结果是 jsx("text", { color: "green", children: "你好" })
// 这里只是帮你理解"标签 = 函数调用"这个概念
const greeting = text({ color: "green", children: "你好" })
```

> Python 类比：Python 没有直接对应。最接近的是 f-string，但 f-string 只能插值，JSX 还能写标签结构、嵌套、属性。如果用过 Jinja2 模板，JSX 类似但写在代码里而不是单独的模板文件。

## JSX 标签的结构

一个 JSX 标签由这几部分组成：

```
<text color="green">你好</text>
 ^    ^     ^        ^    ^
 |    |     |        |    |
标签名 属性名 属性值   子元素 闭合标签
```

| 部分 | 说明 | 类比 |
|------|------|------|
| `text` | 标签名（什么元素） | HTML 的 `<p>`、`<div>` |
| `color="green"` | 属性（元素的配置） | HTML 的 `class="xxx"` |
| `你好` | 子元素（标签里的内容） | HTML 里 `<p>你好</p>` 的"你好" |
| `</text>` | 闭合标签（表示结束） | HTML 的 `</p>` |

## JSX 的 6 条规则

### 规则 1：标签名--小写是内置，大写是组件

```tsx
// 小写标签名 = 内置元素（opentui 提供的终端元素）
<text>文本</text>
<box>容器</box>

// 大写标签名 = 自定义组件（你自己写的函数）
<MyComponent />
<ChatMessage />
```

> 这和 HTML 一样--`<div>`、`<p>` 是内置的，自定义组件用大写开头区分。后面我们会写自定义组件。

### 规则 2：属性--字符串用引号，表达式用花括号

```tsx
// 字符串属性：用双引号（或单引号）
<text color="green">绿色文字</text>

// 表达式属性：用花括号 {} 包裹 TypeScript 表达式
<text color={myColor()}>动态颜色</text>

// 混合使用
<box border={true} title="聊天">
  <text color="cyan">文字</text>
</box>
```

`color="green"` 和 `color={myColor()}` 的区别：
- 引号里的值是**字面字符串**：`"green"` 就是字符串 green
- 花括号里是 **TypeScript 表达式**：`{myColor()}` 会执行 `myColor()` 函数，用返回值作为属性

### 规则 3：子元素--可以嵌套

标签里面可以放其他标签，形成树状结构：

```tsx
<box flexDirection="column">
  <text>第一行</text>
  <text>第二行</text>
</box>
```

这和 HTML 一样：`<div>` 里可以放 `<p>`，`<p>` 里可以放 `<span>`。

### 规则 4：表达式插值--用花括号在子元素里写 TS 代码

在标签内容里，用 `{}` 包裹 TypeScript 表达式：

```tsx
const name = "世界"

<text>你好，{name}！</text>
// 渲染：你好，世界！

<text>1 + 1 = {1 + 1}</text>
// 渲染：1 + 1 = 2

<text>{count() > 5 ? "多" : "少"}</text>
// count() > 5 -> "多"，否则 "少"
```

`{}` 里可以放任何 TypeScript 表达式：变量、函数调用、运算、三元表达式。但不能放语句（如 `if`、`for`）。

> Python f-string 类比：`f"你好，{name}！"` 和 `<text>你好，{name}！</text>` 很像。但 JSX 的 `{}` 还能放标签：`{condition() && <text>显示</text>}`，f-string 做不到。

### 规则 5：自闭合标签--没有子元素时可以简写

```tsx
// 有子元素：开标签 + 内容 + 闭标签
<text>你好</text>

// 没有子元素：可以自闭合（斜杠在 > 前面）
<text />
<spinner />
<input />
```

类似 HTML 的 `<br />` 或 `<img src="..." />`。

### 规则 6：一个组件只能返回一个根标签

```tsx
// ❌ 错误：返回了多个并列标签
function Bad() {
  return (
    <text>第一行</text>
    <text>第二行</text>
  )
}

// ✅ 正确：用一个父标签包起来
function Good() {
  return (
    <box>
      <text>第一行</text>
      <text>第二行</text>
    </box>
  )
}
```

> 为什么？因为一个函数只能返回一个值。两个并列标签等于返回两个值，JavaScript 不支持。用 `<box>` 包起来就变成返回一个 box，里面有两个 text。

## 一个完整的例子

把 6 条规则组合起来：

```tsx
function Greeting(props: { name: string }) {
  // props 是传入的属性，这里 name 是字符串
  const color = "green"  // 普通变量

  return (
    <box flexDirection="column" padding={1}>
      <text color={color}>你好，{props.name}！</text>
      <text>今天是 {new Date().toDateString()}</text>
    </box>
  )
}

// 使用：
<Greeting name="世界" />
// 渲染：
// 你好，世界！（绿色）
// 今天是 Mon Jul 08 2026
```

逐条对应规则：
1. `box`、`text` 是小写内置元素，`Greeting` 是大写自定义组件
2. `flexDirection="column"` 是字符串属性，`padding={1}` 是表达式属性
3. `<box>` 里嵌套了两个 `<text>`
4. `{props.name}`、`{new Date().toDateString()}` 是表达式插值
5. 没用到自闭合（都有子元素）
6. 只返回一个 `<box>` 根标签

## .tsx 文件后缀

包含 JSX 语法的文件必须用 `.tsx` 后缀（不是 `.ts`）。TypeScript 编译器根据后缀决定是否解析 JSX 语法。

```
src/
├── index.ts        # 普通 TS 文件（不含 JSX）
├── llm.ts          # 普通 TS 文件
└── tui/
    └── app.tsx     # 含 JSX 的文件（必须 .tsx）
```

> 我们已经在 tsconfig.json 里配置了 `"jsx": "preserve"` 和 `"jsxImportSource": "@opentui/solid"`，让 TypeScript 理解 JSX 并用 opentui/solid 的运行时。

## 本课小结

1. **JSX** = 在 TypeScript 里写 XML 风格的标签，不是字符串
2. **标签结构**：`<标签名 属性="值">子元素</标签名>`
3. **6 条规则**：
   - 小写 = 内置元素，大写 = 自定义组件
   - 字符串属性用引号，表达式属性用花括号 `{}`
   - 标签可以嵌套
   - 子元素里用 `{}` 插值 TypeScript 表达式
   - 没有子元素可以自闭合 `<text />`
   - 只能返回一个根标签
4. **`.tsx` 后缀**：含 JSX 的文件必须用 `.tsx`

下一步：[9.1 SolidJS 响应式三件套](./03-solidjs-signals.md) -- createSignal、createMemo、createEffect。
