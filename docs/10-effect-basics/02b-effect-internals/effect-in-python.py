# 10.2.5 用 Python 理解 Effect 的内部原理
#
# 跑法：python3 effect-in-python.py
#
# 这个文件用 Python 把 Effect-TS 的核心概念"翻译"出来，
# 让你看清它内部到底在干什么。看完再看 TypeScript 的 Effect 代码就不抽象了。
#
# 两个示例都跑通验证过：
# - 示例 1：Effect 基础（succeed + gen + yield）
# - 示例 2：Service/Layer 依赖注入


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
# Service + Layer：就是一个字典（注册表）
# ════════════════════════════════════════════════════════════

# Context 就是一个字典，存"标签 -> 实现"
context = {}

# Service 是字典的 key（标签）
CONFIG_SERVICE = "ConfigService"


def config_layer():
    """Layer：造实现，放进字典。读一次文件，缓存。"""
    # 模拟读 opencode.json（这里用假数据代替）
    config = {"model": "deepseek-v4-flash", "baseURL": "https://ark.cn-beijing.volces.com"}
    return {"get": lambda: config}  # 实现：get() 返回缓存的 config


def provide(layer, effect):
    """provide = 造实现存进 context，再跑 effect。"""
    def recipe():
        context[CONFIG_SERVICE] = layer()  # 跑 layer，存进 context
        return effect.run()                 # 跑 effect
    return Effect(recipe)


def get_service():
    """yield* ConfigService = 从 context 取实现。"""
    def recipe():
        return context[CONFIG_SERVICE]  # 从字典取
    return Effect(recipe)


# ════════════════════════════════════════════════════════════
# 示例 1：Effect 基础
# ════════════════════════════════════════════════════════════

print("=== 示例 1：Effect 基础 ===")


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
# 示例 2：Service/Layer 依赖注入
# ════════════════════════════════════════════════════════════

print("\n=== 示例 2：Service/Layer ===")


def use_config():
    """两个消费者都从 context 自取 config，不用参数传进来。"""
    config_service = yield get_service()    # 从 context 取（= yield* ConfigService）
    config = config_service["get"]()         # 调 get()（= yield* config.get()）
    print("  拿到 model:", config["model"])
    return "done"


# provide 把 config_layer 存进 context，再跑 program
program2 = provide(config_layer, gen(use_config))
print("provide 完成，还没执行")

result2 = program2.run()   # 1. 跑 config_layer 造实现存进 context  2. 跑 use_config 从 context 取
print("run 结果:", result2)


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
Service         字典的 key                    标签
Layer           造值放字典                     注册实现
provide         先放值再跑                     装配依赖
""")
