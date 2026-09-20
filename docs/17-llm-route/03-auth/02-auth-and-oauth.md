# 17.3 补充：Auth 与 OAuth 分别解决什么问题

这两个名字很像，但不在同一个层级：**Auth 是当前项目的一段代码边界，OAuth 是一套授权协议。**

## 先区分 authentication 和 authorization

- **Authentication（认证）**：证明“你是谁”，例如密码、API key 或 token；
- **Authorization（授权）**：确定“你可以做什么”，例如能访问哪些模型、资源和操作。

工程中常把两者都简称为 `auth`。我们代码里的 `Auth` 更具体：它负责把身份凭据应用到 HTTP 请求，
让服务器能够继续完成认证与权限检查。

## 当前 `Auth` 做了什么

当前代码的输入和输出是：

```text
已有 Headers
    │
    ▼ bearerAuth.apply(...)
加入 Authorization: Bearer <token> 的新 Headers
```

它假设调用者已经拿到了可用 token，只负责把 token 放进正确的 header。它不负责询问用户密码、
打开登录页面、保存凭据、判断过期或请求新 token。

因此当前 Auth 回答的是：**“手里已有凭据，这次请求怎样携带它？”**

## OAuth 做了什么

OAuth 是 delegated authorization（委托授权）框架。它允许用户授权一个客户端访问服务，而不把
账号密码直接交给客户端。简化流程是：

```text
用户
  │ 1. 登录并同意授权
  ▼
Authorization Server
  │ 2. 返回临时 authorization code
  ▼
客户端
  │ 3. 用 code 换 access token / refresh token
  │ 4. 带 access token 请求受保护 API
  ▼
Resource Server
```

几个重要名词：

| 名称 | 作用 |
|---|---|
| authorization code | 短期、一次性的中间凭证，用来换 token |
| access token | 调用 API 时携带的短期凭据 |
| refresh token | access token 过期后，用来申请新 access token |
| scope | 用户授予客户端的权限范围 |

OAuth 回答的是：**“客户端怎样在用户授权后取得并维持可用凭据？”**

## API key 与 OAuth 的差异

| | API key | OAuth |
|---|---|---|
| 凭据来源 | 用户预先创建并写入配置 | 登录授权流程动态取得 |
| 生命周期 | 通常长期有效，手动轮换 | access token 较短，可能需要 refresh |
| 代表关系 | 常代表项目或开发者账号 | 常代表用户对客户端的授权 |
| 当前代码 | `config.apiKey` | 尚未实现 |

两者最终都可能使用同一种 HTTP 形式：

```text
Authorization: Bearer <credential>
```

所以“header 长得一样”不代表凭据管理也一样。固定 API key 可以在创建 Provider 时读一次；OAuth
access token 可能在两次请求之间过期，发送前需要加载、检查并刷新。

## 它们怎样在后续代码中合作

后续接入 OAuth 时，完整职责会是：

```text
OAuth / Credential 层：登录、保存、检查过期、刷新
                         │
                         ▼ 当前可用 access token
Auth 层：              应用到这次 HTTP 请求
                         │
                         ▼ authenticated Headers
Transport：            调用 fetch
```

这也是为什么当前 Auth 以后会演进成 Effect：加载或刷新凭据涉及文件和网络，可能异步失败。现在只有
固定 API key，还没有这个问题，所以 17.3 先保留同步的 `Headers -> Headers`。

OAuth 本身只提供授权机制，不会创造账号原本没有的权限或额度。某项订阅权益能否通过特定客户端
使用，仍由服务端的产品规则和授权范围决定。
