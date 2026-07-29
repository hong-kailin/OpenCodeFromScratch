# 从 Python 到 TypeScript：7 步搬好你的开发环境（口播稿）

你会 Python。现在要写 TypeScript。

别去啃文档。这俩的工具链，能一对一翻译。

python 解释器、pip、type hints、import、pyproject、mypy、pdb——

TS 这边全有对应的。

我用 7 步，把你已经熟的那套 Python 环境，整个搬过来。

最后你会得到一个能写、能跑、能调试的 TS 项目。

---

## 1. Bun：能直接跑 TS 的运行时

先说运行时。

你写 Python 要两样东西。解释器跑代码，pip 装库。

Bun 把这俩合一个工具。它既是运行时，又是包管理器。

对照一下。python 对应 bun，pip 对应 bun install，.py 对应 .ts。

---

那 Node.js 呢？它是更老的 JS 运行时。Bun 是后来者。

Bun 兼容 Node 大部分 API，但更快。

最关键一点——Bun 能原生跑 .ts 文件，不用先编译成 .js。

这一条对我们特别重要。写完 .ts，直接 bun run 就能跑，跟 python script.py 一样直接。

---

opencode 选 Bun 不选 Node，性能是一个原因。

更关键的是原生 TS 支持，加上一体化工具链。运行时、包管理器、打包器，合一个工具。

版本就锁在 bun 1.3.14。

---

macOS 和 Linux，跑官方脚本，curl bun.sh/install 再管道给 bash，一行装好。macOS 也能 brew install oven-sh/bun/bun。

Windows，PowerShell 里 irm bun.sh/install.ps1 再 iex，或者直接 winget install Oven-sh.Bun。

装完重开个终端。

---

验证一下。敲 bun --version，期望输出类似 1.3.13。

---

## 2. 第一个程序：跑通，读报错，打点

写第一个程序，就一行，console.log 打印 hello opencode。

不用配置，不用编译。直接 bun run src/index.ts。

终端吐出 hello opencode。你跑通了第一个 TS。

---

几个差异先记住。打印用 console.log，就是 Python 的 print。

注释用双斜杠，不是井号。

opencode 的风格是不写分号。你会看到 console.log 后面没分号，我们跟着它。

---

代码不会一次跑通。学会读报错是第一步。

故意写个错，用一个没定义的变量。

跑一下，报错先打印了“开始”，然后在出错那行下面有个小箭头，指向出问题的变量。

接着是错误类型，ReferenceError，引用了不存在的变量。

最后是位置，哪个文件、第几行、第几列。

这套路跟 Python 的 traceback 一模一样。ReferenceError 就对应 NameError。

---

最朴素的 debug 是 console.log 打点。

在代码里打印中间变量，看它是不是你以为的值。

举个例子，算两个数的平均值，结果不对。我在函数里打印 sum 和 result。

跑一下，看到 sum 是 30，result 是 15。每一步对不对一目了然。

跟 Python 的 print 加 f 字符串一模一样。

console.log 能接多个参数，空格分隔，所以不用模板字符串。

---

## 3. TS 类型系统：把 type hints 搬过来

先声明一句。这不是完整的 TS 教程。TS 很大。

我只带你建立印象，能看懂后面代码就行。新语法后面用到再讲，不提前塞给你。

---

类型标注，Python 用冒号加类型，TS 也是冒号加类型，只是名字不同。

string 是字符串，number 是数字。注意，number 不分 int 和 float，统一一个 number。

boolean 是布尔，string 加方括号是字符串数组。

跟 Python 对照。str 变成 string，bool 变成 boolean，None 对应 null 或 undefined。

大小写容易写错。Python 小写，TS 全拼。

---

函数有三种写法。函数声明、函数表达式、箭头函数。

函数声明能提升，声明之前就能调用。另外两种不行。

opencode 几乎只用箭头函数，就是 const 加箭头。

---

箭头函数单行能省 return 和花括号，自动返回。

在 map、filter 这种回调里，它特别简洁。

它比 Python 的 lambda 强。lambda 只能单行，箭头函数能写多行，用花括号包起来就行，不用像 Python 那样切回 def。

---

箭头函数还有个本事，是它被发明的真正原因。解决 this 绑定问题。

普通函数的 this 会随调用方式变，经常出错。箭头函数没有自己的 this，继承外层。

这点 Python 没有痛点，因为 self 是显式参数。你不用深究，知道有这回事就行。

---

那个箭头符号还能用在类型标注里。

比如 execute 是个函数，传 string 进去，返回 string。这描述的是函数的类型，不是定义函数。对应 Python 的 Callable。

同一个符号两种角色。看上下文，有函数体是实现，只有类型是签名。

---

union 类型，联合类型。Python 3.10 能写 str 或 int，TS 也一样，用竖线。

还能写字面量联合，比如一个模式只能取 build、plan、general 三个值之一。opencode 里到处都是 union。它的 Error 类型就是四种错误之一。

---

描述对象形状，用 interface 或 type。两者几乎能互换，opencode 两种都用。

比如一个 Tool，有 id、description，还有 execute 函数。

union 只能用 type。继承的话，interface 用 extends，type 用与号。看到哪个懂哪个，不用纠结。

---

泛型，就是类型的参数。Python 3.12 的 def foo 加方括号 T，你应该见过。TS 也是尖括号 T。

写个 identity 函数，传 number 返回 number，传 string 返回 string。

opencode 的 Tool 定义里有俩类型参数，还带约束和默认值。先别慌，看不懂正常。这阶段你只要看到尖括号，知道是泛型就行。

---

还有个快捷的字典类型，Record。Record 里键是 string 值是 number，就等于 Python 的 dict。opencode 经常用 Record string Tool，表示一张工具表。

---

## 4. 模块系统：import 和 export

代码长了要拆文件。拆了就得能互相调用。Python 你熟，from math_utils import add。TS 思路一样，语法不同。用 export 导出，用 import 导入。

---

关键区别在这。Python 默认顶层定义都能被 import。TS 必须显式写 export。不写 export 的，是模块私有的，外面访问不到。

---

导入用花括号，只拿你要的那几个。路径以点斜杠开头，表示相对路径。

还能加 type 前缀，只导入类型，编译后会被删掉，不占运行时体积。类型和函数能混在一句 import 里。

---

导出分两种。命名导出，一个文件能导出好几个。默认导出，一个文件只能有一个。

opencode 的约定是几乎只用命名导出，不用默认。你看它源码，全是花括号导入。我们跟着它。

---

路径写法记几种。点斜杠是当前目录，点点斜杠是上级目录。不带前缀直接写包名，是第三方包。还有一种 @ 别名，需要 tsconfig 配，下下节课讲。

---

import 写错路径会报错。Cannot find module。读法是，找不到模块，你写的路径，在哪个文件里 import 的。

跟 Python 的 ModuleNotFoundError 一样。排查方法一样，检查文件名和路径。

---

## 5. package.json：项目配置和依赖

上节课留了个悬念。想 import 第三方包，得先装进来。Python 用 pip install。TS 用什么？这就需要 package.json。

---

package.json 就是项目的身份证，对应 Python 的 pyproject.toml。依赖列表、版本、自定义命令，都在里面。

对照一下。pyproject 对应 package.json，pip install 对应 bun install，uv lock 对应 bun lock，.venv 对应 node_modules。

---

看我们的 package.json。name 是项目名，version 是版本号，private 标记私有，防止误发到 npm。

有一行 type 设成 module，很重要。它声明这个项目用 ESM 模块系统，就是 import 和 export，不是老的 require。

不写它，.ts 里的 import 可能会报错。opencode 也有这行。

---

scripts 是自定义命令，类比 Makefile。定义后用 bun run 加命令名执行。dev 跑程序，typecheck 做类型检查。

---

依赖分两种。dependencies 是运行时要的，devDependencies 是只在开发时要的。

区分原则。用户运行程序时还需要的，放 dependencies。只是开发检查时需要的，放 devDependencies。

比如 yargs 解析命令行，运行时要用，放 dependencies。typescript 只用来检查，部署后不需要，放 devDependencies。

我们现在只装了 dev 依赖，因为还没运行时依赖。等调 LLM 那步才装第一个。

---

装依赖一条命令，bun install。它读 package.json，全装进 node_modules，还生成 bun.lock 锁文件，锁定每个包的精确版本。

加新依赖用 bun add。带 -d 就是装到 dev 依赖。bun add 会自动更新 package.json 和 lock 文件。

---

版本号写法。latest 是最新版。加号允许小版本更新，波浪号只允许补丁更新，写死就是精确版本。加号那个，类似 Python 的大于等于 18 小于 19。

---

node_modules 很大，不能提交 git，要用 gitignore 忽略。跟 Python 的 .venv 不提交一个道理。

但 bun.lock 要提交，保证团队依赖版本一致。

---

import 一个没装的包，会报 Cannot find module 加包名。注意，没有点斜杠前缀的包名找不到，说明你没装。解决就是 bun add 那个包，对应 pip install。

---

## 6. tsconfig：类型检查配置，和运行分开

上节课的 typecheck 命令，我说还跑不了，因为缺 tsconfig。现在补上。

先问个问题。bun 能直接跑 ts，为啥还要配类型检查？

因为运行和检查是两回事。Bun 运行时直接跑代码，不做类型检查。类型标注在运行时会被忽略。跟 Python 运行时不查 type hints 一样。

你写 const x 是 number 却赋个字符串，Bun 照跑不报错。要发现这种错，得单独跑类型检查器 tsc。tsc 需要配置文件，就是 tsconfig，对应 Python 的 mypy.ini。

---

看我们的配置。extends 继承官方的 Bun 预设，少写一堆字段。strict 开严格检查，对应 mypy --strict。noEmit 只检查不产出 js 文件，因为 Bun 直接跑 ts，不需要编译产物。

---

有一行特别关键，types 设成 bun。没有它，console 和 Bun 这些全局变量会报 Cannot find name console。

这个坑我踩过。第一次配 tsconfig，typecheck 报了一堆这个错，就是漏了这行。

---

paths 配路径别名。@ 别名指向 src。有了它，深层文件不用写一串点点斜杠，从 src 根开始写就行。

opencode 源码里到处是 import from @ 开头的路径。后面我们会大量用。

---

include 限定只检查 src 目录下的 ts 文件。这很重要。不限定的话，tsc 会扫整个项目，包括 opencode 参考源码，几百个文件，报一堆跟我们无关的错。

exclude 排除 node_modules、opencode，还有那几个故意写错的教学文件。

---

配好跑 typecheck。代码没问题，命令没有任何输出，静默成功。有错才会打印。

---

类型错误长啥样？故意写一个，把字符串赋给 number。

报错给出文件、行号、列号，还有错误码 TS2322，可以拿这个码去搜原因。下面一排波浪线，标出出错的变量。

跟运行时报错的区别。类型错误是编译时查出来的，代码根本没跑就报了。Python 的 mypy 报错也是这个风格。

类型错误越早发现越好。写代码时编辑器就红线标出来，比上线崩掉强。

---

## 7. VSCode 断点调试：别只会 console.log

到目前为止你靠 console.log 打点。很有效，但有局限。

想看某个条件下的值，得加 if 加打印，改完再跑一遍。想看调用链，得一层层手动加打印。状态复杂时，打印太多看不过来。

---

断点调试解决这些。暂停程序，看所有变量，一步步走，随时改变量。就像 Python 的 pdb 或 PyCharm 调试器，换到 VSCode 加 Bun。

---

先装 Bun 扩展。VSCode 默认不认 Bun。搜 Bun，装 Oven Software 那个。

---

然后配 launch.json。type 设 bun，request 设 launch，直接启动调试。program 设当前文件，cwd 设项目根目录。

opencode 用的是 attach 模式，连到正在跑的 TUI 程序。我们用更简单的 launch。

---

设断点。点行号左边的灰色区域，出现红点。或者按 F9。断点要设在会执行的语句行上，设在 function 声明行上不会触发。

---

设好按 F5。程序启动，跑到断点处暂停。

---

左侧调试面板。Variables 看当前作用域所有变量，对应 PyCharm 的变量面板。Watch 手动加要监视的表达式。Call Stack 看调用链，就是正向的 traceback。

---

单步执行几个按钮。Step Over 是 F10，执行当前行不进函数，对应 pdb 的 n。Step Into 是 F11，进函数内部，对应 pdb 的 s。Step Out 是 Shift F11，执行完当前函数回到调用处。

区别记一下。当前行调用了函数 foo。Step Over 把 foo 当一步，执行完停下一行。Step Into 会进 foo 内部暂停。

---

实操一下。算一组成绩的平均值。五个分，85、92、78、96、88。

在算平均那行设断点，按 F5。暂停后，Variables 里看到 sum 是 439，scores 是那五个数。Call Stack 显示 calculateAverage 指向全局作用域。

按 F10，average 变量出现，值是 87.8。按 F5 继续，程序跑完，输出平均分 87.8。

---

两个进阶技巧。

条件断点。右键断点，输个条件，比如 i 等于 3，只有那时才停。不用改代码。

日志断点。不想暂停只想打印，输个内容，比如 sum is 加花括号 sum。跑到这行只在控制台打一条，等于自动加 console.log，但不动代码、不用重跑。

---

什么时候用断点，什么时候用 console.log？复杂逻辑、想看多个变量、想一步步走，用断点。快速看一个值、简单确认，用 console.log，更快，不用开调试器。循环里想看每次迭代又不想停，用日志断点。

---

有个常见坑。按 F5 闪一下就没了。

通常是断点位置不对，设在不会执行的行上。或者断点被禁用了，灰心圆，点一下重新启用。或者断点所在的代码根本没执行到，比如在 if 块里但条件没满足。

---

## 8. 阶段验收：整条工具链通了

跑一遍验收，五条命令。

bun version 看运行时。bun run dev 看程序能跑，输出 hello opencode。bun run typecheck 看类型检查通过，无输出。bun run 一个模块 demo，看导入正常。最后 VSCode 设断点按 F5，看能暂停。

全过，阶段 0 就完成了。

---

我们的 index.ts 就一行 console.log。

opencode 的入口长啥样？它 import 了 yargs，注册 run、serve、debug 这些子命令。差距很大，但方向能看出来。

opencode 用 yargs 做命令行解析，对应 Python 的 argparse 或 click。这些我们到阶段 8 才实现。

---

最后聊点工程思维。

运行时和类型检查是分开的。Python 习惯一个命令既能跑也能报类型错。TS 把它拆开了。Bun 管跑，tsc 管查。这是关注点分离。Python 把它们混在一起，TS 拆开了。

配置文件是项目的契约。package.json 声明依赖和怎么跑，tsconfig 声明用什么规则，bun.lock 锁死版本。新人 clone 下来，bun install 加 bun run dev 就能跑，不用问任何人。好的项目自己说明自己。

还有一点，先跑通再完善。一行 console.log 验证了整条工具链通了。后面往里加 LLM、工具系统、session 管理，基础是可靠的。先建立最小闭环，再逐步加功能。别一上来就写复杂代码。

---

你现在能写 TS、能跑、能调试了。下一步要开始真正搭 agent。

源码我放在 opencode-from-scratch，链接置顶评论区。

想跟着做的，先把你 Python 那套环境，照这 7 步翻译一遍。

下期见。
