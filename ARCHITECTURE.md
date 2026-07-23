# 系统架构

本文只记录当前已冻结的管理员访问与运行边界。Cookie、期限、CSRF、CORS 等精确值在本文中仅作为不可变安全边界；字段级定义和管理端消费方式唯一以 [管理端 API 规范](.agents/skills/api-contract/admin-web-api.md) 为准，完整取舍和验收矩阵以 [管理员访问与运行基线 Spec](docs/specs/admin-access-runtime-baseline.md) 及 [ADR-0001 至 ADR-0008](docs/adr/) 为准。

## 运行边界

- 后端固定使用 Node.js `22.21.0` 的原生 ESM JavaScript；`backend/package.json` 通过 `engines` 约束 `>=22.21.0 <23`，根 `.nvmrc` 精确锁定 `22.21.0`。
- React 管理端与 Koa API 独立部署：生产地址分别为 `https://apollo.example.com` 和 `https://apis.example.com`；本地开发地址分别为 `http://localhost:4000` 和 `http://localhost:4001`。
- Koa 在开发和生产环境都只监听 `127.0.0.1`。生产环境只信任同机反向代理覆盖写入的单个来源地址，不启用宽泛代理信任。
- MongoDB 是管理员聚合、管理会话、登录限速和安全审计的持久化边界。Mongoose 负责连接、Schema、Model 和索引定义，业务服务通过薄仓储访问，不直接操作 Model 或原生驱动。
- 唯一管理员的初始化和访问恢复只在受信部署主机上通过交互式 CLI 执行，不开放 HTTP 入口，见 [ADR-0001](docs/adr/0001-admin-credential-operations-via-cli.md)。

## 运行配置

后端只接受以下运行配置：

| 配置 | 边界 |
| --- | --- |
| `NODE_ENV` | 只允许 `development`、`test`、`production` |
| `PORT` | 开发环境默认 `4001` |
| `MONGODB_URI` | 必填；包含主机、端口、数据库名、认证信息和 `authSource` 等参数的完整 MongoDB URI，不拆分读取连接字段 |
| `ADMIN_JWT_SECRET` | 必填；解码后至少 256 位 |
| `SECURITY_HMAC_SECRET` | 必填；必须与 `ADMIN_JWT_SECRET` 不同，用于限速键和审计摘要 |
| `ADMIN_WEB_ORIGIN` | 开发固定为 `http://localhost:4000`，生产固定为 `https://apollo.example.com` |
| `LOG_LEVEL` | 可选，默认 `info` |

管理端只使用 `APP_API_BASE_URL` 和开发服务器 `APP_PORT`：开发值分别为 `http://localhost:4001`、`4000`，生产 `APP_API_BASE_URL` 固定为 `https://apis.example.com`；生产静态部署不使用 `APP_PORT`。

Cookie 名称与属性、JWT 算法与声明、会话期限、5 分钟活动采样间隔、`Argon2id` 最低参数、登录限速阈值和 CORS 凭据策略均为安全常量，不允许通过环境配置改变。所有配置在服务启动前一次性校验，缺失、格式错误或互相冲突时拒绝启动。

仓库只提交使用不可用占位值的 `.env.example`；真实 MongoDB URI 和秘密配置只能由运行环境注入，日志和错误响应不得输出其任何部分或完整连接串。

## 启动与停机

启动顺序固定为：校验全部运行配置、连接 MongoDB、建立或核验当前切片的集合校验器与索引，全部成功后才监听 HTTP 端口。任一步骤失败都不得开放服务，并以非零退出码结束。

收到 `SIGINT` 或 `SIGTERM` 后立即进入排空状态：就绪检查返回 `503`，存活检查在进程仍存续时继续响应；服务停止接收新连接，最多等待已有请求 10 秒，然后关闭 HTTP 服务和 MongoDB 连接。正常排空以退出码 `0` 结束，超时或关闭失败以非零退出码结束。

`GET /health/live` 不访问 MongoDB；`GET /health/ready` 以 MongoDB 连接、集合校验器和索引就绪为准。管理员尚未初始化不影响就绪状态。

## 跨源管理会话

- 管理会话采用状态型 JWT：JWT 仅存放在 API 主机设置的 `HttpOnly` Cookie 中，同时以 MongoDB `admin_sessions` 记录提供即时撤销和空闲失效，见 [ADR-0002](docs/adr/0002-stateful-admin-jwt-sessions.md)。
- 生产 Cookie 为 `__Host-admin_session`，属性固定为 `Path=/; HttpOnly; Secure; SameSite=Strict`；开发 Cookie 为 `admin_session`，不设置 `Secure`。两者均不设置 `Domain`。
- 管理端所有 API 请求使用凭据模式。管理端不使用 `Authorization`，JWT 不进入 JSON 响应，也不写入 `localStorage`、`sessionStorage`、Redux、URL 或其他浏览器持久化位置。
- 管理端只在内存中保存会话绑定的 CSRF 令牌；所有已认证写请求同时校验精确 `Origin` 和 `X-CSRF-Token`，见 [ADR-0003](docs/adr/0003-cross-origin-admin-deployment.md) 与 [ADR-0004](docs/adr/0004-admin-csrf-protection.md)。
- 空闲期限为 30 分钟，绝对期限为 12 小时；活动最多每 5 分钟持久化一次，JWT 不刷新。普通退出只撤销当前会话；修改密码和访问恢复通过递增 `sessionGeneration` 撤销全部会话，见 [ADR-0005](docs/adr/0005-admin-session-generation.md)。

## 默认拒绝链路

`/admin/**` 的中间件顺序固定为：请求标识与安全响应头、精确来源 CORS、公开例外判断、管理会话认证、已认证写请求 CSRF 校验、业务路由。

- 公开白名单只有健康检查、`POST /admin/auth/login` 和合法 CORS 预检；健康检查不启用 CORS。
- `/admin/**` 必须携带精确匹配当前环境管理端地址的 `Origin`。CORS 只允许 `GET`、`POST`、`PATCH`、`OPTIONS` 及 `Content-Type`、`X-CSRF-Token`，明确不允许 `Authorization`。
- 除登录外，管理路由默认要求有效管理会话；业务路由不能自行声明公开。未认证访问未知管理路径返回 `401 ADMIN_AUTH_REQUIRED`，认证后才可返回 `404`。
- `POST /admin/auth/logout` 是唯一幂等清理特例：会话不存在时仍清除 Cookie 并返回 `204`；会话有效时必须通过 CSRF 校验后才能撤销。
- 管理会话与小程序业务会话使用不同的中间件、Cookie 和身份上下文，不能互相替代。

## 审计与日志边界

- HTTP 请求与 CLI 操作由后端生成 UUID v4 `requestId`；不采纳客户端提供的 `X-Request-ID`。HTTP 响应、错误体、运行日志和安全审计使用同一标识关联。
- 运行日志以单行 JSON 写入标准输出或标准错误；不直接写应用日志文件。日志不得包含请求或响应正文、Cookie、密码、密码散列、JWT、CSRF 令牌、原始 IP、原始登录名、秘密配置或 MongoDB URI。
- 管理员状态和会话状态是权威事实，安全审计在权威写入后追加。审计失败不回滚或改写已完成动作的结果，改写 `error` 级结构化日志作为降级证据，见 [ADR-0008](docs/adr/0008-audit-failure-fallback.md)。
- 审计只保存必要的稳定事件、结果和 HMAC 摘要，不保存原始 `jti`、IP、登录名或任何认证秘密；数据结构与索引见 [技术数据字典](docs/TECH.md)。
