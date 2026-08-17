# Python yield 学习代码
#
# 跑法：python3 yield-demo.py
#
# 演示 Python generator 的 yield 机制：
# 1. 普通函数 vs 生成器函数
# 2. next() 驱动生成器
# 3. send() 往生成器里喂值
# 4. StopIteration 拿 return 的值
#
# 这些是 Effect.gen 的底层机制，理解了这个再看 Effect 就不神秘了。


# ════════════════════════════════════════════════════════════
# 1. 普通函数 vs 生成器函数
# ════════════════════════════════════════════════════════════

print("=== 1. 普通函数 vs 生成器函数 ===")


# 普通函数：调用一次，返回一个值，就结束了
def add(a, b):
    return a + b


result = add(1, 2)
print("普通函数 add(1, 2):", result)


# 生成器函数：带 yield，能暂停、能恢复、产出一个又一个值
def count():
    print("  第一步")
    yield 1        # 产出 1，暂停
    print("  第二步")
    yield 2        # 产出 2，暂停
    print("  第三步")
    yield 3        # 产出 3，暂停


# 调用生成器函数，不会执行里面的代码，只是拿到生成器对象
g = count()
print("创建生成器，还没执行")


# ════════════════════════════════════════════════════════════
# 2. next() 驱动生成器
# ════════════════════════════════════════════════════════════

print("\n=== 2. next() 驱动生成器 ===")

print("next(g) 第 1 次:")
val = next(g)  # 执行到第一个 yield，产出 1，暂停
print("  拿到:", val)

print("next(g) 第 2 次:")
val = next(g)  # 从暂停处继续，执行到第二个 yield，产出 2，暂停
print("  拿到:", val)

print("next(g) 第 3 次:")
val = next(g)  # 继续，产出 3，暂停
print("  拿到:", val)

# 再调一次会怎样？没有更多 yield 了，抛出 StopIteration
print("next(g) 第 4 次（会报错）:")
try:
    next(g)
except StopIteration:
    print("  StopIteration！生成器结束了")


# ════════════════════════════════════════════════════════════
# 3. send() 往生成器里喂值
# ════════════════════════════════════════════════════════════

print("\n=== 3. send() 往生成器里喂值 ===")


def echo():
    """yield 不只能产出值，还能接收外部传进来的值。"""
    while True:
        received = yield  # 产出 None（暂停），被 send(x) 调用时 received = x
        print(f"  收到: {received}")


g2 = echo()
next(g2)           # 第一步：必须先 next 一次启动生成器
g2.send("hello")   # 把 "hello" 喂回 yield，打印: 收到: hello
g2.send("world")   # 把 "world" 喂回 yield，打印: 收到: world
print("send 就是'恢复生成器 + 喂回一个值'")


# ════════════════════════════════════════════════════════════
# 4. return 的值从 StopIteration 拿
# ════════════════════════════════════════════════════════════

print("\n=== 4. return 的值从 StopIteration 拿 ===")


def my_program():
    x = yield 10   # 产出 10，暂停。被 send 时 x = send 的值
    y = yield 20   # 产出 20，暂停。被 send 时 y = send 的值
    return x + y   # 生成器也可以 return，值从 StopIteration.value 拿


g3 = my_program()
val1 = next(g3)         # 拿到 10
val2 = g3.send(100)     # 把 100 喂给第一个 yield（x=100），拿到 20
try:
    g3.send(200)        # 把 200 喂给第二个 yield（y=200），遇到 return，抛 StopIteration
except StopIteration as e:
    print(f"  第一个 yield 拿到: {val1}")
    print(f"  第二个 yield 拿到: {val2}")
    print(f"  return 的值: {e.value}")  # 100 + 200 = 300


# ════════════════════════════════════════════════════════════
# 4b. next 和 send 的关系：next 就是 send(None)
# ════════════════════════════════════════════════════════════

print("\n=== 4b. next(g) 就是 g.send(None) ===")


def simple():
    val = yield "A"   # 产出 "A"，暂停。被 next 调用时 val=None，被 send(x) 时 val=x
    print(f"  yield 收到了: {val}")
    yield "B"         # 产出 "B"，暂停
    return "结束"


# 用 next 调用：喂回 None
g4 = simple()
a = next(g4)      # 拿到 "A"。喂回 None（但 val 还没被赋值）
print(f"  next 拿到: {a}")

# 用 send 调用：喂回指定值
b = g4.send(42)   # 喂回 42 给第一个 yield（val=42），打印"yield 收到了: 42"，拿到 "B"
print(f"  send 拿到: {b}")

# next 和 send 都做同一件事：恢复生成器 + 拿 yield 的值
# 区别只是喂回什么：next 喂 None，send 喂你指定的值
print("  next(g) = g.send(None)，都是'恢复生成器 + 拿 yield 的值'")


# ════════════════════════════════════════════════════════════
# 4c. send 喂的是"当前暂停的 yield"，不能指定喂哪个
# ════════════════════════════════════════════════════════════

print("\n=== 4c. send 喂的是当前暂停的 yield ===")


def two_yields():
    x = yield 10   # 第 1 个 yield
    y = yield 20   # 第 2 个 yield
    return x + y


# 先调两次 next，再 send(100)：100 喂给的是 y，不是 x
g5 = two_yields()
val1 = next(g5)       # 跑到第 1 个 yield，产出 10，暂停在 x = ___ 处
val2 = next(g5)       # 喂 None 给第 1 个 yield（x=None），跑到第 2 个 yield，产出 20
print(f"  两次 next 后: val1={val1}, val2={val2}")
print(f"  此时 x=None，生成器暂停在第 2 个 yield")

try:
    g5.send(100)      # 喂 100 给第 2 个 yield（y=100），不是给 x！
except StopIteration as e:
    print(f"  send(100) 后: y=100, x=None（之前被 next 喂了 None）")
    print(f"  return 的值: {e.value}")  # None + 100 会 TypeError，所以到不了这里
except TypeError as e:
    print(f"  TypeError: {e}")  # None + 100 报错
    print("  因为 x=None（被 next 喂的），y=100（被 send 喂的），None+100 报错")

print("  结论：send 喂的是'当前暂停的 yield'，由调用顺序决定，不能指定")


# ════════════════════════════════════════════════════════════
# 5. 这就是 Effect.gen 的机制
# ════════════════════════════════════════════════════════════

print("""
=== 5. 和 Effect 的对应关系 ===

Python              Effect (TypeScript)         含义
────────────────    ──────────────────────      ──────────────
def f(): yield ...  function* () { yield* ... }  能暂停的函数
yield               yield*                      暂停并交出/接收值
next(g)             gen 内部自动做              启动/恢复生成器
g.send(value)       gen 内部自动做              把结果喂回生成器
StopIteration       生成器结束                  return 的值从这里拿

Effect.gen 就是上面的流程自动化：
  拿到 yield 的 Effect -> 执行它(run) -> 把结果 send 回去 -> 拿下一个
""")
