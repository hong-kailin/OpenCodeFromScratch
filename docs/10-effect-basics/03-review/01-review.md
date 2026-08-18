# 10.3 阶段验收

## 验收清单

- [ ] 能解释 Effect 是什么——"计算的描述"而非"计算的执行"
- [ ] 能写出 `Effect.succeed` / `Effect.fail` 创建基本 Effect
- [ ] 能用 `Effect.gen(function* () { ... })` + `yield*` 串联多步计算
- [ ] 能用 `Effect.promise(async () => ...)` 桥接现有的 Promise 代码
- [ ] 能用 `.pipe(Effect.map(fn))` 在 run 前变换 Effect
- [ ] 能区分 `runPromise` 和 `runSync` 的使用场景
- [ ] 能读懂 fiber trace 报错信息

## 验证方式

```bash
bun run src/effect-demo.ts
```

预期输出 9 个节，每节打印结果，第 9 节打印一个 fiber trace 错误（这是正常的教学演示）。

## 工程思维

**为什么要"描述而非执行"？** 因为组合性。如果 Effect 创建时就执行了，你就没法在 run 前做变换——值已经算出来了。延迟让 Effect 像"乐高积木"一样可组合：先搭好结构，再点火。

这个思想贯穿后续所有 Effect 概念——Service/Layer 是在描述上加"依赖注入"，Stream 是在描述上加"流式处理"，Schema 是在描述上加"运行时校验"。它们都是"描述"的不同维度，可以正交组合。

## 下一步

阶段 11：Service + Layer——用 Effect 的依赖注入机制解决"参数到处传"的痛点。