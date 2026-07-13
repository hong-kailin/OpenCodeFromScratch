# 10.2.5 用 Python 理解 Effect 的内部原理

> 你知道 Python 但不熟悉 Effect。这课用 Python 把 Effect 的核心思想"翻译"出来，让你看清它内部到底在干什么。看完这个，再回去看 TypeScript 的 Effect 代码就不觉得抽象了。

## 核心思想：Effect 就是一个"还没执行的函数"

Effect 的本质特别简单：**把"要做什么"存起来，先不执行，等你说"run"才执行**。

用 Python 说，就是这样：

```python
class Effect:
    def __init__(self, recipe):
        # recipe 是一个函数，描述"要做什么"
        # 存起来，不执行
        self.recipe = recipe

    def run(self):
        # 真正执行，调用 recipe
        return self.recipe()
```

`Effect` 就是一个包装类，里面存着一个函数 `recipe`。创建时不调用 `recipe`，`run()` 时才调用。

就这么简单。没有什么魔法。

## succeed：把值包成 Effect

```python
def succeed(value):
    # recipe 就是"返回这个值"
    return Effect(lambda: value)
```

`succeed(42)` 就是创建一个 Effect，它的 recipe 是 `lambda: 42`（一个返回 42 的函数）。没执行，只是存着。`run()` 时才返回 42。

## yield*（拆盒子）= 执行内层 Effect，拿值

在 TypeScript 里我们写 `yield* someEffect`。在 Python 里，"拆盒子"就是调用 `.run()`：

```python
# TypeScript: const a = yield* Effect.succeed(10)
# Python 等价：
a = succeed(10).run()  # a = 10
```

## Effect.gen：串联多步

这是最关键的部分。TypeScript 里我们写：

```ts
const sum = Effect.gen(function* () {
  const a = yield* Effect.succeed(10)
  const b = yield* Effect.succeed(20)
  return a + b
})
```

用 Python"翻译"，就是利用 Python 的 generator（`yield`）：

```python
def gen(generator_func):
    """Effect.gen 的 Python 版"""
    def recipe():
        g = generator_func()       # 创建 generator
        try:
            inner = next(g)        # 拿到第一个 yield 的 Effect
            while True:
                value = inner.run()    # 拆盒子：执行内层 Effect
                inner = g.send(value)  # 把值喂回 generator，拿下一个
        except StopIteration as e:
            return e.value          # generator return 的值
    return Effect(recipe)
```

然后就能这样用（和 TypeScript 一模一样的结构）：

```python
def my_program():
    a = yield succeed(10)   # yield = yield*，拆 succeed(10) 的盒子
    b = yield succeed(20)   # 拆 succeed(20)
    return a + b            # return 30

program = gen(my_program)   # 创建 Effect，不执行
result = program.run()      # 执行，拿到 30
print(result)               # 30
```

看到没？**Python 的 `yield` 就是 TypeScript 的 `yield*`。** Python 的 generator function（`def f(): yield ...`）就是 TypeScript 的 `function* () { yield* ... }`。Effect 借用了 generator 的机制来实现"串联多步"。

`gen` 做的事：创建 generator -> 拿到第一个 yield 的 Effect -> 执行它(run) -> 把结果喂回 generator -> 拿下一个 yield 的 Effect -> 循环，直到 generator return。

## 延迟性

现在延迟性也一目了然了：

```python
program = gen(my_program)  # 只是创建 Effect，存了 recipe，没执行
# 这时 my_program 里的代码一行都没跑

result = program.run()     # 调用 recipe，这才开始执行
```

`gen()` 存了 recipe 不执行，`run()` 才执行。这就是"延迟性"。

## Service + Layer：就是一个字典

Service/Layer 的本质更简单--就是一个字典（注册表）。

```python
# Context 就是一个字典
context = {}

# Service 是字典的 key（标签）
CONFIG_SERVICE = "ConfigService"

# Layer 是"造实现，放进字典"
def config_layer():
    config = read_file("opencode.json")  # 读一次文件
    return {"get": lambda: config}       # 实现：get() 返回 config

# provide = 造实现，存进 context，再跑 program
def provide(layer, effect):
    def recipe():
        context[CONFIG_SERVICE] = layer()  # 跑 layer，存进 context
        return effect.run()                 # 跑 effect
    return Effect(recipe)

# yield* ConfigService = 从 context 取实现
def get_service():
    def recipe():
        return context[CONFIG_SERVICE]  # 从字典取
    return Effect(recipe)
```

用的时候：

```python
def my_program():
    config_service = yield get_service()    # 从 context 取（= yield* ConfigService）
    config = config_service["get"]()         # 调 get()（= yield* config.get()）
    print(config["model"])
    return "done"

program = provide(config_layer, gen(my_program))
# provide 存了 layer 和 program，没执行

result = program.run()
# 1. 跑 config_layer()，造实现，存进 context
# 2. 跑 my_program()，从 context 取实现，用
```

**Service 就是字典的 key，Layer 就是往字典里放值，provide 就是"放完值再跑程序"，yield\* ConfigService 就是从字典取值。** 这就是依赖注入的全部本质。

## 对照表

| Effect 概念 | Python 等价 | 本质 |
|------------|-----------|------|
| Effect | 存着函数的类 | "还没执行的函数" |
| succeed(x) | `Effect(lambda: x)` | 把值包成"返回值的函数" |
| yield* | `.run()` | 执行函数，拿结果 |
| Effect.gen | Python generator + send | 串联多步 |
| function* | `def f(): yield ...` | 能用 yield 的函数 |
| Service | 字典的 key | 标签 |
| Layer | 造值放字典 | 注册实现 |
| provide | 先放值再跑 | 装配依赖 |
| fail(error) | `Effect(lambda: raise error)` | 把错误包成 Effect |

## 为什么不直接用 Python 这种方式？

你可能会问：Python 这种方式更简单，为什么要用 Effect 搞这么复杂？

因为 Effect 在简单的外表下加了**类型安全**和**组合性**：
- TypeScript 的类型系统会检查"你 provide 了所有需要的 Service"--忘了 provide 编译就报错
- Effect 的 `.pipe(Effect.map(...))` 能在 run 前变换计算
- Effect 的错误是类型化的，能精确捕获

Python 版只是"原理演示"，缺少这些保障。但理解了 Python 版的原理，再看 Effect 的 TypeScript 代码就不觉得抽象了--你知道每个概念对应什么。

## 本节小结

1. **Effect = 存着函数的类**：创建时不执行，run() 才执行
2. **succeed = `Effect(lambda: 值)`**：把值包成"返回值的函数"
3. **yield\* = `.run()`**：执行内层 Effect，拿结果
4. **Effect.gen = Python generator**：用 yield 串联多步，gen 负责协调
5. **Service/Layer = 字典**：Service 是 key，Layer 是放值，provide 是"先放值再跑"

---

下一步：[10.3 Service + Layer：依赖注入](../03-service-layer/01-what-is-service.md) -- 现在你知道了原理，去看 TypeScript 怎么实现就不抽象了。
