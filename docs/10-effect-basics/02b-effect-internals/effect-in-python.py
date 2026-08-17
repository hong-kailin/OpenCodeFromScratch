# 10.2.5 用 Python 理解 Effect 的内部原理
#
# 跑法：python3 effect-in-python.py
#
# 这个文件用 Python 把 Effect-TS 的核心概念"翻译"出来，
# 让你看清它内部到底在干什么。看完再看 TypeScript 的 Effect 代码就不抽象了。
#
# 示例：Effect 基础（succeed + gen + yield）


# ════════════════════════════════════════════════════════════
# Effect 的核心：一个"还没执行的函数"
# ════════════════════════════════════════════════════════════


class Effect:
    """Effect 就是一个包装类，里面存着一个函数 recipe。

    创建时不调用 recipe，run() 时才调用。
    这就是"延迟性"：先描述，后执行。
    """

    def __init__(self, recipe):
        self.recipe = recipe  # 存着"要做什么"，不执行

    def run(self):
        return self.recipe()  # 真正执行


def succeed(value):
    """把一个值包成 Effect。recipe 就是"返回这个值"。"""
    return Effect(lambda: value)


def fail(error):
    """把错误包成 Effect。run() 时才抛出。"""
    def recipe():
        raise error
    return Effect(recipe)


def gen(generator_func):
    """Effect.gen 的 Python 版。

    利用 Python 的 generator（yield）串联多步 Effect。
    做的事：创建 generator -> 拿到 yield 的 Effect -> 执行它(run) ->
    把结果喂回 generator -> 拿下一个 -> 循环，直到 return。
    """
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


# ════════════════════════════════════════════════════════════
# 示例：Effect 基础
# ════════════════════════════════════════════════════════════

print("=== Effect 基础 ===")


def my_program():
    """和 TypeScript 的 Effect.gen(function* () { ... }) 结构一模一样。"""
    a = yield succeed(10)   # yield = yield*，拆 succeed(10) 的盒子，拿到 10
    b = yield succeed(20)   # 拆 succeed(20)，拿到 20
    return a + b            # return 30


program = gen(my_program)   # 创建 Effect，不执行
print("创建完成，还没执行")

result = program.run()      # 执行，拿到 30
print("run 结果:", result)


# ════════════════════════════════════════════════════════════
# 对照表
# ════════════════════════════════════════════════════════════

print("""
=== 对照表 ===
Effect 概念      Python 等价                    本质
──────────────  ──────────────────────────  ──────────────
Effect          存着函数的类                   "还没执行的函数"
succeed(x)      Effect(lambda: x)            把值包成函数
yield*          .run()                       执行函数拿结果
Effect.gen      Python generator + send      串联多步
function*       def f(): yield ...           能用 yield 的函数
""")

