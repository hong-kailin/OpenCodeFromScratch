# async/await：异步编程

> 本课目标：理解为什么调 LLM API 要用 async/await，学会它的基本语法。从实际代码现象出发，不提前抛概念。

## 问题：调 LLM 要等几秒

你用 `console.log` 打印是**瞬间完成**的。但调 LLM API 不是——网络请求要等几秒。问题是：等待期间程序能不能干别的事？

先看一段代码，模拟"等 2 秒"的效果：

```ts
// src/async-demo.ts

// setTimeout：2 秒后执行里面的代码（类似 Python 的 time.sleep 但不卡住）
setTimeout(() => {
  console.log("2 秒到了")
}, 2000)

console.log("我先执行了")
```

跑一下：

```bash
bun run src/async-demo.ts
```

输出：

```
我先执行了
（等 2 秒）
2 秒到了
```

注意顺序：`setTimeout` 没有卡住程序，`console.log("我先执行了")` 立刻执行了。2 秒后回调才触发。

**这就是异步**——不干等，先往下跑，好了再回来。

## 新问题：怎么拿到异步操作的结果

`setTimeout` 能不卡住，但有个问题：它**拿不到结果**。如果我想要"2 秒后算出一个值，然后在后面的代码里用它"，怎么写？

这就是 `Promise` 和 `async/await` 解决的问题。

## 第一步：用 Promise 包装慢操作

先别管 Promise 是什么，看代码：

```ts
// slowTask 返回一个 Promise<string>
// 意思是："我承诺 2 秒后给你一个 string"
function slowTask(): Promise<string> {
  return new Promise((resolve) => {
    setTimeout(() => resolve("慢操作完成"), 2000)
  })
}
```

先记住两个词：

- **Promise**：一个"承诺"，将来会给你一个值
- **resolve**：承诺兑现，把值交出去

`resolve("慢操作完成")` 就是"2 秒到了，值是这个字符串"。

## 第二步：用 await 拿到值

`slowTask()` 返回 Promise，不是直接的值。怎么拿到值？用 `await`：

```ts
async function main() {           // async：标记这个函数里用 await
  console.log("1. 开始")
  const result = await slowTask() // await：等 Promise 兑现，拿到真正的值
  console.log("2. result =", result)
  console.log("3. 结束")
}

main()
```

输出：

```
1. 开始
（等 2 秒）
2. result = 慢操作完成
3. 结束
```

`await` 做了一件事：**等 Promise 兑现，把值拿出来**。

## 对比：不加 await 会怎样

```ts
async function main() {
  console.log("1. 开始")
  const result = slowTask()      // ❌ 忘了 await
  console.log("2. result =", result)
  console.log("3. 结束")
}
```

输出：

```
1. 开始
2. result = Promise { <pending> }
3. 结束
```

`result` 不是 `"慢操作完成"`，而是 `Promise { <pending> }`——承诺还没兑现。程序没等 2 秒就往下跑了。

**关键问题：不加 await，slowTask 还会执行吗？**

会。两种情况下 `slowTask()` 都会执行完（2 秒后 Promise 都会兑现）。区别在于**程序等不等它**：

| | 加 await | 不加 await |
|---|----------|------------|
| 程序行为 | **暂停**在 await 这行，等 2 秒拿到值后继续 | **不暂停**，立刻往下跑 |
| result 拿到什么 | `"慢操作完成"`（真正的值） | `Promise { <pending> }`（还没兑现的承诺） |
| slowTask 执行了吗 | 执行了 | 也执行了（2 秒后在后台兑现，但没人接收） |

```
// 加 await 的执行过程：
1. 开始
（暂停 2 秒，等 slowTask）
2. result = 慢操作完成    ← 等到了，拿到真正的值
3. 结束

// 不加 await 的执行过程：
1. 开始
2. result = Promise { <pending> }  ← 没等，立刻拿到一个"还没好的承诺"
3. 结束
（2 秒后 slowTask 在后台兑现了，但没人接收）
```

`await` 就是"等"的意思——加了就等，不加就不等。

## 两个关键字总结

### async：标记函数

```ts
async function main() {
  // 这个函数里可以用 await
}
```

- 加了 `async` 的函数叫"异步函数"
- 只有 async 函数里才能用 `await`
- 不加 async 的函数里写 `await` 会报错

### await：等 + 拿值

```ts
const result = await slowTask()
//               └─┬─┘
//               await：等 slowTask 的 Promise 兑现，拿到值
```

- `await` 后面跟一个返回 Promise 的操作
- 它会暂停当前函数，等 Promise 兑现
- 兑现后把值拿出来，继续往下执行

## 套到 fetch 上

`fetch()` 就是返回 Promise 的函数——因为网络请求要等：

```ts
async function chat() {
  // fetch 返回 Promise，用 await 拿到响应
  const response = await fetch(url)

  // response.json() 也返回 Promise，用 await 拿到数据
  const data = await response.json()

  console.log(data)
}
```

**规律**：凡是涉及"等待"的操作（网络请求、读文件、定时器），都返回 Promise，都要用 `await`。

## 三个容易踩的坑

### 坑 1：忘了 await

```ts
async function main() {
  const response = fetch(url)  // ❌ 忘了 await
  console.log(response)        // 打印 Promise { <pending> }，不是响应
}
```

### 坑 2：忘了 async

```ts
function main() {              // ❌ 没加 async
  const response = await fetch(url)  // 报错：await 只能在 async 函数里用
}
```

### 坑 3：顶层 await

我们的 `src/index.ts` 里直接写了 `await`，没有包在 `async function` 里：

```ts
// src/index.ts
const config = await loadConfig()  // 顶层 await，没有 async 函数包裹
```

这是 TS/Bun 的特殊支持——**顶层 await**，在入口文件里可以直接用 `await`，不用包一层 `async function`。

## 跑一下教学代码

```bash
bun run src/async-demo.ts
```

会看到三种写法的对比：
1. 不用 await（拿到 Promise，不是值）
2. 用 await（等 2 秒，拿到真正的值）
3. 两次 await 串行（等 4 秒）

## 本课小结

1. **异步**：不干等，先往下跑，好了再回来
2. **Promise**：一个"承诺"，将来给你一个值
3. **async**：标记函数可以用 `await`
4. **await**：等 Promise 兑现，拿到真正的值
5. **规律**：网络请求、读文件都返回 Promise，都要 `await`
6. **不加 await**：拿到的是 Promise，不是值

下一步：[1.3 用 fetch 调 API](./02-fetch-basics.md) —— 用 async/await 调 LLM API。
