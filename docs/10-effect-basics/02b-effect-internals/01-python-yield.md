# 10.2.5 Python 的 yield：Effect 的底层机制

> Effect 的 `yield*` 借用了 Python generator 的 `yield` 机制。如果你没写过 Python 的 `yield`，这课先补上。理解了 `yield`，再看 Effect 的 `yield*` 就不觉得神秘了。

## 普通函数 vs 生成器函数

Python 的普通函数，调用一次，返回一个值，就结束了：

```python
def add(a, b):
    return a + b

result = add(1, 2)  # result = 3，函数结束
```

生成器函数（带 `yield` 的函数）不一样。它不是"一次返回一个值"，而是**能暂停、能恢复、能产出一个又一个值**：

```python
def count():
    print("第一步")
    yield 1        # 产出 1，暂停
    print("第二步")
    yield 2        # 产出 2，暂停
    print("第三步")
    yield 3        # 产出 3，暂停
```

`yield` 的意思是："把这个值交出去，然后**暂停**在这里。等下次叫我，我从这里继续。"

## 怎么调用生成器

调用生成器函数，不会执行里面的代码，而是拿到一个"生成器对象"：

```python
g = count()   # 不执行！只是拿到生成器对象
```

要用 `next()` 才能让它跑起来：

```python
print(next(g))  # 打印"第一步"，产出 1，暂停。输出: 1
print(next(g))  # 从暂停处继续，打印"第二步"，产出 2，暂停。输出: 2
print(next(g))  # 继续，打印"第三步"，产出 3，暂停。输出: 3
```

每次 `next(g)`，生成器从上次暂停的地方继续执行，遇到下一个 `yield` 就交出值并暂停。

再调一次 `next(g)` 会怎样？生成器没有更多 `yield` 了，抛出 `StopIteration`：

```python
next(g)  # 抛出 StopIteration，表示生成器结束了
```

## yield 的执行流程图

```
next(g) 第 1 次:
  执行 print("第一步")
  遇到 yield 1 → 交出 1，暂停 ←—————————┐
                                          │
next(g) 第 2 次:                          │
  从暂停处继续                             │
  执行 print("第二步")                     │
  遇到 yield 2 → 交出 2，暂停 ←—————————┤
                                          │
next(g) 第 3 次:                          │
  从暂停处继续                             │
  执行 print("第三步")                     │
  遇到 yield 3 → 交出 3，暂停 ←—————————┘
                                          │
next(g) 第 4 次:                          │
  从暂停处继续                             │
  没有 yield 了 → 抛出 StopIteration
```

关键：**yield 不是 return。return 是"结束函数"，yield 是"暂停函数，等下次叫再继续"。**

## send：不只是产出，还能接收值

`yield` 还能接收外部传进来的值。用 `g.send(value)` 代替 `next(g)`：

```python
def echo():
    while True:
        received = yield   # 产出 None（暂停），下次被 send(x) 调用时，received = x
        print(f"收到: {received}")

g = echo()
next(g)           # 第一步：启动生成器（必须先 next 一次）
g.send("hello")   # 打印: 收到: hello
g.send("world")   # 打印: 收到: world
```

`g.send("hello")` 做两件事：
1. 把 `"hello"` 塞回 `yield` 那个位置，赋给 `received`
2. 生成器继续执行，遇到下一个 `yield` 又暂停

### next 和 send 的关系

你可能注意到上面先用了 `next(g)` 再用 `g.send(...)`。它们是什么关系？

其实 `next(g)` 就是 `g.send(None)` 的简写--**两者做的是同一件事**：恢复生成器 + 拿 yield 产出的值。区别只在于喂回什么：

- `next(g)` = 喂 `None` 回去
- `g.send(100)` = 喂 `100` 回去

两个都**会拿到** yield 产出的值。看这个例子：

```python
def my_program():
    x = yield 10   # 产出 10，暂停。被 send(100) 调用时 x = 100
    y = yield 20   # 产出 20，暂停。被 send(200) 调用时 y = 200
    return x + y   # 300

g = my_program()
val1 = next(g)        # 喂 None 回去，拿到 yield 10 的 10
val2 = g.send(100)    # 喂 100 回去（x=100），拿到 yield 20 的 20
g.send(200)           # 喂 200 回去（y=200），遇到 return -> StopIteration，e.value = 300
```

每一步都做两件事：**喂值回去 + 拿下一个 yield 的值**。`next` 只能喂 `None`，`send` 能喂任意值。

一句话：**`next(g)` = `g.send(None)`，都是"恢复生成器 + 拿 yield 的值"，send 额外能指定喂回什么值。**

### send 喂的是"当前暂停的 yield"，不能指定喂哪个

一个容易搞混的点：`send(100)` 的 100 喂给哪个 yield？**不是你选的，是生成器当前暂停在哪个 yield，就喂给哪个。**

看这个例子--如果先调两次 next，再 send(100)：

```python
def my_program():
    x = yield 10   # 第 1 个 yield
    y = yield 20   # 第 2 个 yield
    return x + y

g = my_program()
next(g)        # 跑到第 1 个 yield，产出 10，暂停在 x = ___ 处（x 还没赋值）
next(g)        # 喂 None 给第 1 个 yield（x = None），跑到第 2 个 yield，产出 20，暂停在 y = ___ 处
g.send(100)    # 喂 100 给第 2 个 yield（y = 100）！不是给 x！
               # 因为现在暂停在第 2 个 yield，send 喂的就是它
               # 然后 return x + y = None + 100 -> TypeError
```

两次 next 之后，生成器已经暂停在第二个 yield 了。所以 `send(100)` 喂给的是 y，不是 x。而 x 已经被第二次 next 喂了 None。

**一句话：send 喂的是"生成器当前暂停的那个 yield"，由调用顺序决定，不能指定。**

**这就是 Effect.gen 用的机制。** Effect 的 `yield*` 对应 Python 的 `yield`，`gen` 用 `send` 把内层 Effect 的结果喂回生成器。

## 和 Effect 的对应关系

| Python | Effect (TypeScript) | 含义 |
|--------|-------------------|------|
| `def f(): yield ...` | `function* () { yield* ... }` | 能暂停的函数 |
| `yield` | `yield*` | 暂停并交出/接收值 |
| `next(g)` | gen 内部自动做 | 启动/恢复生成器 |
| `g.send(value)` | gen 内部自动做 | 把结果喂回生成器 |
| `StopIteration` | 生成器结束 | `return` 的值从这里拿 |

Effect 的 `gen` 函数（见 [下一课](./02-effect-internals.md)的 Python 实现）就是用 `next` + `send` 协调生成器的：拿到 `yield` 的 Effect -> 执行它 -> 把结果 `send` 回去 -> 拿下一个。

## 一句话总结

**`yield` 是"暂停 + 交出值"，`send` 是"恢复 + 喂回值"。** Effect 的 `yield*` 和 `Effect.gen` 借用的就是这个机制。理解了 Python 的 yield/send，Effect 的拆盒子就不神秘了。

---

下一步：[用 Python 理解 Effect 的内部原理](./02-effect-internals.md)
