# 管理员访问与运行基线 Spec

> 状态：架构与跨端契约已于 2026-07-22 确认并冻结，可作为后续实施计划输入；本轮不包含代码实现。

## 来源与范围

本 Spec 是路线图议题 [#1](https://github.com/coocssweb/comic_strip/issues/1) 的第一个业务垂直切片，落实 [#11](https://github.com/coocssweb/comic_strip/issues/11)、[#13](https://github.com/coocssweb/comic_strip/issues/13)、[#15](https://github.com/coocssweb/comic_strip/issues/15)、[#16](https://github.com/coocssweb/comic_strip/issues/16) 和 [#17](https://github.com/coocssweb/comic_strip/issues/17) 已冻结的前置决策。

当前切片负责建立唯一管理员登录、管理会话、默认拒绝、安全审计和最小运行骨架。字段级契约、数据模型、失败语义和验收矩阵将在本轮盘问中逐项冻结。

## 健康检查

| 方法与路径 | 语义 | 依赖 | 成功结果 |
| --- | --- | --- | --- |
| `GET /health/live` | Koa 进程可以响应 | 不访问 MongoDB | `200 { "status": "ok" }` |
| `GET /health/ready` | 当前切片必要依赖已经就绪 | MongoDB 连接、集合校验和索引 | `200 { "status": "ok" }` |

- 就绪依赖未满足时返回 `503 { "status": "unavailable" }`；MongoDB 故障不要求进程退出，存活检查仍可成功。
- 两个端点均无需认证，不返回版本、环境变量、数据库地址、异常详情、管理员初始化状态或其他内部信息。
- 管理员尚未初始化不影响就绪状态；初始化由受信 CLI 独立完成。
- COS、CDN 和后续业务模块不属于当前切片的就绪依赖。

## 最小运行骨架范围

当前切片包含：

- 建立 `backend/package.json` 和 Koa 应用入口。
- 提供开发启动、生产模式启动、测试、管理员初始化和访问恢复脚本。
- 启动时校验配置、连接真实 MongoDB、建立当前切片集合校验与索引，然后开放 HTTP 服务。
- 提供统一请求标识、错误处理、结构化日志、CORS、Cookie、安全头和健康检查中间件。
- 支持正常关闭：停止接收请求、关闭 HTTP 服务和 MongoDB 连接。
- 让 React 管理端通过配置连接真实后端，完成当前切片真实联调。

当前切片不包含 Docker、Docker Compose、Nginx 安装与生产配置、TLS 证书、DNS、systemd、PM2、云主机初始化、MongoDB 生产部署与备份恢复、COS、CDN 或完整上线编排。这些生产交付项归第七切片“上线与恢复验证”，当前切片只冻结所需接口和安全前提。

### 后端测试基线

- 后端单元测试和集成测试使用 Node.js 内置 `node:test` 与 `node:assert/strict`，不为后端另行引入 Jest。
- MongoDB 集成测试必须通过独立的 `TEST_MONGODB_URI` 连接真实 MongoDB，不使用内存数据库或 Mongoose Model mock 代替持久化行为。
- 每次测试运行在测试命名空间下创建带随机后缀的独立数据库；测试清理逻辑只能删除本次运行创建且通过命名安全校验的数据库。
- `TEST_MONGODB_URI` 未明确指向测试命名空间、与生产配置冲突或待清理数据库不满足随机测试命名规则时，测试在执行任何删除前拒绝运行。
- HTTP 契约测试启动真实 Koa HTTP 服务并监听 `127.0.0.1` 的系统随机端口，通过网络请求验证中间件顺序、响应头、Cookie、错误契约和 MongoDB 状态。

### 浏览器联调基线

- 当前切片使用 Playwright 驱动 Chromium 完成真实管理端与后端联调；暂不运行 Firefox、WebKit，也不包含视觉回归测试。
- 联调测试自动启动 React 管理端和 Koa 后端两个真实 HTTP 服务，后端连接本次运行的随机真实 MongoDB 测试数据库，不拦截或伪造认证 API。
- 每个用例使用全新非持久化浏览器上下文，隔离 Cookie、内存状态和缓存；不生成或复用包含认证 Cookie 的持久化状态文件。
- 最小浏览器路径覆盖登录、刷新后恢复会话、退出、修改密码后重新登录，以及 Cookie 凭据、CSRF、CORS 和会话过期跳转。
- Playwright 测试结束时按与后端集成测试相同的安全规则关闭双服务并只清理本次创建的随机测试数据库。

### 后端语言与模块格式

- 后端固定使用 Node.js `22.21.0` LTS 的原生 ESM JavaScript，`backend/package.json` 固定 `"type": "module"`，并通过 `engines` 约束 `>=22.21.0 <23`。
- 仓库使用 `.nvmrc` 固定 `22.21.0`；后续 22.x 升级必须显式评估并提交，不自动漂移到新的 Node.js 主版本。
- 当前切片不引入 TypeScript、转译步骤或双模块格式发布；开发、测试与生产直接执行同一份 JavaScript。
- 配置、仓储、领域服务和 HTTP 请求/响应等关键边界使用 JSDoc 描述输入输出类型；类型注释不能替代运行时请求校验、MongoDB 集合校验或配置校验。

### MongoDB 数据访问

- 后端引入 Mongoose 管理连接、Schema、Model 和索引定义，不由业务代码直接使用 MongoDB 原生驱动访问集合。
- HTTP 控制器和领域服务不得直接操作 Mongoose Model；每个集合由薄仓储模块封装，原子条件更新、会话世代 CAS、TTL 索引和审计追加语义必须在仓储接口中显式表达。
- Mongoose Schema 使用严格字段约束并禁用未在契约中定义的隐式字段；MongoDB 集合级 JSON Schema 仍是最终存储防线，不能仅依赖 ODM 校验。
- 启动阶段显式建立或核验当前切片要求的集合校验器和索引，不依赖请求触发建表，也不允许 Mongoose 在运行中静默改变权威数据结构。

### 进程生命周期

- 启动顺序固定为：校验全部运行配置、连接 MongoDB、建立或核验当前切片所需集合校验器与索引，全部成功后才监听 HTTP 端口。
- 任一启动步骤失败时不得开放 HTTP 服务，记录不含秘密的致命错误并以非零退出码结束。
- 收到 `SIGINT` 或 `SIGTERM` 后立即进入排空状态；存活检查在进程存续期间仍可响应，就绪检查立即返回 `503 { "status": "unavailable" }`。
- 排空状态停止接受新连接，最多等待已有请求 10 秒；随后关闭 HTTP 服务和 MongoDB 连接。
- 在 10 秒内正常排空时以退出码 `0` 结束；超时、HTTP 服务关闭失败或 MongoDB 关闭失败时记录错误并以非零退出码结束。

### 管理端页面范围

- `/login` 提供登录名、密码、提交状态和统一错误提示。
- `/` 是受保护的管理端空壳，只显示当前登录名，并提供修改密码和退出登录入口；不提前实现仪表盘或后续业务菜单。
- 应用启动先恢复管理会话：成功后进入受保护空壳，`401` 跳转登录，服务失败显示可重试故障页且不误判为退出。
- 已登录访问 `/login` 时跳转 `/`；未登录访问任何受保护路径时跳转 `/login`。
- 不提供注册、忘记密码、记住登录名、记住我或修改登录名入口；访问恢复只提示联系运维执行 CLI。
- 请求层改为 Cookie 凭据模式和内存 CSRF 令牌，不兼容旧 `admin-session-token`。
- 只复用符合本 Spec 的基础 UI 组件，不复用现有强制字符组合的 `PasswordStrengthIndicator`。

### 修改密码交互

- 受保护空壳中的“修改密码”使用项目公共 `Dialog` 打开表单，不新增独立路由。
- 表单包含当前密码、新密码和确认新密码，分别使用 `current-password` 与 `new-password` 自动填充语义。
- 前端只校验必填、15～128 个 Unicode 码点及两次新密码一致，不实现字符组合规则或自制强度评分；输入不自动去除空格，最终 NFC 规范化、阻止名单和当前密码判断以服务端为准。
- 提交期间禁止重复提交。当前密码错误时清空当前密码字段并保留新密码字段；网络或服务失败时保留表单供重试；关闭弹窗时清空全部密码。
- 修改成功后清除内存中的管理员与 CSRF 状态，跳转 `/login` 并显示一次性提示“密码已修改，请重新登录”，不自动使用新密码重新登录。

### 会话到期交互

- 管理端以服务端返回的 `idleExpiresAt` 和 `absoluteExpiresAt` 中较早者为准，在到期前 5 分钟弹出提醒。
- 不监听鼠标或键盘活动，也不发送静默保活请求；管理员点击“继续使用”时才调用 `GET /admin/auth/session`。
- 会话恢复成功后更新权威期限并关闭提醒；返回 `401` 时进入登录页；服务失败时保留提醒并提供重试。
- 到期后清除管理员、CSRF 令牌和全部密码输入并跳转 `/login`。
- 密码不得写入 `localStorage`、`sessionStorage`、Redux 持久化或 URL，也不跨重新登录恢复。
- 当前切片没有其他业务表单，不实现通用草稿恢复机制；未来非敏感业务表单由对应切片单独设计。

### 管理端状态归属

| 状态 | 存放位置 | 原因 |
| --- | --- | --- |
| 认证阶段 `bootstrapping / authenticated / unauthenticated / unavailable` | `authSlice` | 全局路由与页面共享 |
| 当前管理员 `{ id, username }` | `authSlice` | 全局认证业务状态 |
| `idleExpiresAt / absoluteExpiresAt` | `authSlice` | 路由、到期提醒和续期共享 |
| CSRF 令牌 | 请求模块私有内存 | 避免进入 Redux DevTools、浏览器存储或组件 Props |
| 登录表单 | `/login` 页面 `useState` | 未提交的页面局部状态 |
| 修改密码表单与弹窗开关 | 弹窗局部状态 | 敏感临时输入和纯 UI 状态 |
| 登录后的单次提示 | React Router `location.state` | 一次性导航信息，不需全局保存 |
| 到期提醒开关 | 受保护布局局部状态 | 可由 Redux 中的期限推导 |

- 使用 `authSlice + useAuth`，页面和组件不得直接 `dispatch`。
- 认证请求不使用 RTK Query；请求模块先截留 CSRF 令牌，只把脱敏后的管理员与期限写入 Redux。
- 请求层遇到确定的 `401 ADMIN_AUTH_REQUIRED` 时清除私有 CSRF 令牌并通知认证状态失效。
- Redux、`localStorage`、`sessionStorage` 和 URL 中不得出现 JWT、CSRF 令牌或密码。
- 状态归属表直接保存在本 Spec，不另建 `STATE_DESIGN.md`。

### 本地开发地址与 Cookie

- React 管理端运行于 `http://localhost:4000`，后端 API 运行于 `http://localhost:4001`。
- 开发环境 CORS 只允许 `http://localhost:4000`；生产环境只允许 `https://apollo.example.com`。
- 开发环境 Cookie 名为 `admin_session`，属性为 `Path=/; HttpOnly; SameSite=Strict`，不设置 `Secure` 或 `Domain`。
- 生产环境 Cookie 名为 `__Host-admin_session`，属性为 `Path=/; HttpOnly; Secure; SameSite=Strict`，不设置 `Domain`。
- 管理端始终使用凭据模式请求，不使用 Webpack API 代理；本地开发不引入 HTTPS 证书。
- 生产 Cookie 安全属性由启动配置校验和自动化测试锁定，不允许生产环境降级为开发 Cookie。

### 运行配置

后端只接受以下运行配置：

- `NODE_ENV`：只允许 `development`、`test`、`production`。
- `PORT`：开发默认 `4001`。
- `MONGODB_URI`：必填，接受包含主机、端口、数据库名、认证信息和 `authSource` 等参数的完整 MongoDB URI；应用不再拆分读取数据库连接字段。
- `ADMIN_JWT_SECRET`：必填，解码后至少 256 位。
- `SECURITY_HMAC_SECRET`：必填且必须与 JWT 密钥不同，用于限速键和审计摘要。
- `ADMIN_WEB_ORIGIN`：开发为 `http://localhost:4000`，生产固定为 `https://apollo.example.com`。
- `LOG_LEVEL`：可选，默认 `info`。

管理端只使用 `APP_API_BASE_URL` 和开发服务器 `APP_PORT`；开发值分别为 `http://localhost:4001`、`4000`，生产 API 地址为 `https://apis.example.com`。

Cookie 名称与属性、JWT 算法与声明、会话期限、活动采样间隔、`Argon2id` 最低参数、登录限速阈值和 CORS 凭据策略不开放环境配置。配置在服务启动前一次性校验，缺失、格式错误或互相冲突时拒绝启动；仓库只提交使用不可用占位值的 `.env.example`，真实 URI 仅由运行环境注入，日志和错误响应不得输出其中任何部分或完整 MongoDB 连接串。

### 请求标识与运行日志

- HTTP 请求和 CLI 操作均由后端生成新的 UUID v4 `requestId`；不采纳或透传客户端提供的 `X-Request-ID`，避免外部输入污染内部追踪空间。
- HTTP 响应始终通过 `X-Request-ID` 返回该标识；错误响应体、结构化运行日志和安全审计使用同一个值关联，CLI 输出同一操作标识。
- 运行日志使用单行 JSON 写入标准输出或标准错误，不直接写入应用管理的日志文件；日志采集、轮换和保留由部署环境负责。
- 请求完成日志只记录时间、级别、稳定事件名、`requestId`、HTTP 方法、路由模板、状态码、耗时，以及确有必要的管理员或会话散列标识；不记录未经模板化的完整 URL 或查询串。
- 禁止记录请求正文、响应正文、Cookie、密码、密码散列、JWT、CSRF 令牌、原始来源 IP、原始登录名、秘密配置值或完整 MongoDB URI。
- 成功的存活与就绪检查不写访问日志；失败的健康检查和其他服务错误仍写安全摘要。

### API 安全响应头

- 后端所有响应统一设置 `X-Content-Type-Options: nosniff`、`Referrer-Policy: no-referrer`，并通过 `Permissions-Policy` 禁用当前 API 不需要的浏览器能力。
- API 的内容安全策略至少包含 `default-src 'none'`、`frame-ancestors 'none'` 和 `base-uri 'none'`，防止 JSON 或错误内容被当作可执行页面加载或嵌入。
- 所有 `/admin/auth/**` 成功与失败响应均设置 `Cache-Control: no-store`，不允许浏览器或中间缓存保存认证结果。
- 生产环境响应设置一年期 `Strict-Transport-Security`，不启用 `preload`；开发环境 HTTP 响应不设置 HSTS。
- 管理端静态页面所需的页面 CSP、资源白名单及其他代理层响应头由第七切片的反向代理配置落地，本切片不生成生产 Web 服务器配置。

### 认证请求正文

- 需要正文的认证端点只接受 UTF-8 `application/json`，解码后的请求正文上限为 `8 KiB`；不支持压缩正文、表单编码或文件上传。
- 登录请求只允许 `username`、`password`，修改密码请求只允许 `currentPassword`、`newPassword`；缺失字段、未知字段、类型错误或非法 JSON 均返回 `400 VALIDATION_ERROR`。
- `GET /admin/auth/session` 和 `POST /admin/auth/logout` 不接受请求正文，携带正文时返回 `400 VALIDATION_ERROR`。
- 请求正文超过上限时返回 `413 PAYLOAD_TOO_LARGE`；需要 JSON 正文却使用其他媒体类型时返回 `415 UNSUPPORTED_MEDIA_TYPE`。

。

## 已确认的架构决策

- 唯一管理员初始化与访问恢复只通过部署主机上的后端 CLI 执行，见 [ADR-0001](../adr/0001-admin-credential-operations-via-cli.md)。
- 管理会话采用 JWT，并以 MongoDB 会话记录保证即时撤销和空闲失效，见 [ADR-0002](../adr/0002-stateful-admin-jwt-sessions.md)。
- React 管理端位于 `https://apollo.example.com`，管理 API 位于 `https://apis.example.com`，见 [ADR-0003](../adr/0003-cross-origin-admin-deployment.md)。
- 管理写请求同时执行精确来源校验和会话绑定的 CSRF 令牌校验，见 [ADR-0004](../adr/0004-admin-csrf-protection.md)。

## 管理会话时效

- 空闲期限为 30 分钟，绝对期限为 12 小时。
- MongoDB 中的 `idleExpiresAt` 是空闲期限的唯一权威事实；管理活动按 5 分钟粒度延长期限，且不得越过绝对期限。
- JWT 的 `exp` 固定为绝对期限，不使用刷新令牌；绝对期限届满后必须重新登录。
- 距上次活动持久化不足 5 分钟时，有效请求不写会话且不改变权威期限；达到 5 分钟后收到的首个有效请求，原子更新 `lastSeenAt` 和 `idleExpiresAt = min(当前时间 + 30 分钟, absoluteExpiresAt)`。
- 连续使用时每 5 分钟至多写一次；停止操作后，实际空闲失效最多比逐请求精确计算提前不足 5 分钟。
- 不使用进程内活动缓冲或异步刷写，避免进程重启造成期限回退或多份权威状态。
- 管理端在到期前提示管理员；失效后清除认证状态和密码输入并跳转登录，不在当前切片实现通用表单恢复。

### 时间表示与时钟权威

- MongoDB 中的时间字段统一存储为 UTC `Date`，API 时间统一序列化为带毫秒和 `Z` 后缀的 RFC 3339 UTC 字符串。
- 登录和会话恢复响应返回服务端生成响应时的顶层 `serverTime`；管理端用它估算本机时钟偏差并驱动五分钟到期提醒。
- 会话、JWT、限速和审计的时间判断只使用后端时钟；前端倒计时仅是交互提示，不具有授权意义。
- JWT 验证仍只使用已确认的 30 秒时钟偏差容忍，不把前端上送时间作为输入。

## 并发管理会话

- 唯一管理员可以同时持有多个管理会话，不设置人为数量上限。
- MVP 不提供会话列表、设备识别或逐设备会话管理。
- 普通退出只撤销当前 JWT 的 `jti` 所对应的管理会话。
- 修改密码或执行管理员访问恢复时撤销全部管理会话；登录名只能在管理员访问恢复中变更。
- 管理会话规模通过登录限速、12 小时绝对期限和安全审计控制，不增加会话淘汰规则。

## 全部管理会话撤销

- 唯一管理员聚合保存单调递增的 `sessionGeneration`，JWT 和管理会话记录保存签发时的世代值，具体一致性策略见 [ADR-0005](../adr/0005-admin-session-generation.md)。
- 每次管理鉴权同时校验 JWT、管理会话记录和管理员当前世代；任一不一致均视为管理会话失效。
- 修改密码或执行访问恢复时，在同一次管理员文档原子更新中变更凭据并递增世代；登录名只能在访问恢复中变更。
- 世代递增是全部撤销的权威完成条件；旧会话记录随后通过可重试清理删除，不参与撤销正确性判断。
- 普通退出只撤销当前管理会话记录，不递增世代。
- 已经通过鉴权并开始执行的请求不强行中断；撤销从后续鉴权开始生效。

## 管理会话数据模型

MongoDB 集合 `admin_sessions` 使用以下最小字段：

```json
{
  "_id": "JWT 的 UUID v4 jti",
  "sessionGeneration": 1,
  "csrfTokenHash": "CSRF 令牌 SHA-256 摘要的 base64url 编码",
  "createdAt": "MongoDB Date",
  "lastSeenAt": "MongoDB Date",
  "idleExpiresAt": "MongoDB Date",
  "absoluteExpiresAt": "MongoDB Date"
}
```

- `idleExpiresAt` 始终等于 `min(lastSeenAt + 30 分钟, absoluteExpiresAt)`。
- `idleExpiresAt` 建立 TTL 索引，同时负责空闲和绝对期限后的最终清理；TTL 删除时机不参与鉴权正确性，每次请求仍显式比较期限。
- 普通退出直接删除当前文档；全部撤销依靠 `sessionGeneration`，旧文档随后通过可重试清理删除。
- 会话文档不保存冗余 `adminId`、登录名、权限、IP、User-Agent、`revokedAt`、JWT 原文或 CSRF 令牌原文。
- 单管理员且会话量极小，除 `_id` 和 `idleExpiresAt` TTL 外不建立其他索引。

## 安全审计一致性

- 管理员状态和管理会话状态是权威事实，相关原子业务写入完成后再追加安全审计，完整取舍见 [ADR-0008](../adr/0008-audit-failure-fallback.md)。
- 审计写入失败不回滚已经完成的密码修改、访问恢复、退出或会话撤销，也不把已完成动作对外报告为失败。
- 已完成的 API 动作仍返回成功；CLI 仍以成功退出码结束，但额外输出中文审计告警。
- 审计失败必须写入 `error` 级结构化运行日志，包含 `requestId`、事件类型和失败原因摘要，不包含秘密。
- 登录失败等没有业务写入的事件在审计失败时同样降级到结构化运行日志。
- MVP 不引入审计 outbox、消息队列或后台补写；上线验收覆盖审计集合和降级日志两条路径。
- 审计记录不是业务状态的权威来源，不能根据审计缺失推断操作未发生。

### 安全审计数据模型

MongoDB 集合 `security_audits` 使用以下字段：

```json
{
  "_id": "ObjectId",
  "occurredAt": "MongoDB Date",
  "eventType": "稳定事件枚举",
  "outcome": "succeeded | failed | throttled",
  "actorType": "anonymous | admin | trusted_operator | system",
  "requestId": "请求追踪标识",
  "adminId": "primary-admin，可选",
  "sessionIdHash": "会话标识摘要，可选",
  "sourceIpHash": "来源 IP 摘要，可选",
  "credentialKeyHash": "规范化登录名摘要，可选",
  "reasonCode": "稳定原因码，可选",
  "sessionGeneration": "相关会话世代，可选",
  "revocationScope": "current | all，可选"
}
```

- 所有摘要使用独立安全 HMAC 密钥生成，不保存原始 IP、登录名、`jti`、JWT 或 CSRF 令牌。
- 不提供自由格式 `metadata`；数据库 JSON Schema 限定字段类型和枚举，应用层按事件类型限制允许出现的可选字段。
- 审计仓储只暴露追加方法，不提供业务更新或删除能力；审计不设置 TTL，也不随管理员、会话或业务对象清理。
- 仅建立 `occurredAt`、`requestId` 和 `eventType + occurredAt` 三组查询索引；`requestId` 不唯一，因为同一请求可以产生多个事件。


## JWT 签名与密钥

- JWT 固定使用 `HS256`，签发与验证端只允许这一种算法，不信任令牌自行声明的其他算法。
- 签名密钥由密码学安全随机数生成，至少包含 256 位熵，不允许使用人类可记忆的字符串。
- 签名密钥通过部署环境的秘密配置注入，不进入代码、MongoDB、日志或镜像。
- 签名密钥缺失、格式错误或强度不足时，后端拒绝启动。
- MVP 不维护多密钥轮换环；更换签名密钥将使全部现有管理 JWT 失效，并按全部管理会话撤销处理。

### JWT 头部与声明

JWT 头部固定为：

```json
{
  "alg": "HS256",
  "typ": "admin-session+jwt"
}
```

声明固定为：

```json
{
  "iss": "comic-strip-api",
  "aud": "comic-strip-admin",
  "sub": "primary-admin",
  "jti": "UUID v4 会话标识",
  "iat": 0,
  "exp": 0,
  "sessionGeneration": 1,
  "csrfToken": "256 位随机令牌"
}
```

- `iat` 和 `exp` 使用 JWT NumericDate，`exp` 对应 12 小时绝对期限。
- 验证时固定检查 `alg`、`typ`、`iss`、`aud`、`sub`、`jti`、`iat` 和 `exp`，允许最多 30 秒时钟偏差。
- 单密钥策略不使用 `kid`；拒绝带有 `jku`、`x5u` 等动态密钥查找头部的令牌。
- JWT 不保存登录名、密码散列、权限列表、空闲期限或其他可从 MongoDB 读取的状态。
- `sessionGeneration` 和 `csrfToken` 是本项目约定的私有声明。

## CSRF 令牌生命周期

- 每个管理会话生成一个 256 位随机 CSRF 令牌；JWT 私有声明携带令牌原文，MongoDB 管理会话记录只保存其 SHA-256 摘要。
- 登录响应返回令牌原文；页面刷新后，管理端通过只读会话恢复接口重新取得令牌。
- 会话恢复接口只从已验证 JWT 读取令牌，并在摘要与当前管理会话记录一致时返回。
- 管理端只在内存中保存令牌，写请求通过 `X-CSRF-Token` 请求头发送。
- 同一浏览器的多个标签页共享同一管理会话和 CSRF 令牌；会话恢复不轮换令牌，避免标签页之间相互失效。
- 普通退出、会话过期或全部撤销后，CSRF 令牌随对应管理会话失效。

## 管理员认证 API

管理 API 固定使用 `https://apis.example.com/admin/auth` 前缀：

### 统一错误响应

所有 API 错误统一返回：

```json
{
  "code": "ADMIN_AUTH_REQUIRED",
  "message": "管理会话已失效，请重新登录",
  "requestId": "请求追踪标识"
}
```

- HTTP 状态表达通用结果类别，`code` 表达稳定业务原因；前端只依据 HTTP 状态和 `code` 判断流程，不解析 `message`。
- `message` 始终为中文且可安全展示，`requestId` 用于关联结构化日志与安全审计；响应不暴露堆栈、数据库字段或内部路径。
- 表单校验失败可以额外返回 `fieldErrors` 对象，键为请求字段，值为安全的中文字段提示。
- 登录失败、当前密码错误、限速和会话错误不返回 `fieldErrors` 或其他诊断细节。
- 成功响应保持各端点已确认的原始结构或 `204 No Content`，不增加统一成功外壳。

错误码映射：

| HTTP | `code` | 使用场景 |
| ---: | --- | --- |
| `400` | `VALIDATION_ERROR` | 请求体、登录名或新密码格式不合法 |
| `401` | `ADMIN_CREDENTIALS_INVALID` | 登录名不存在或密码错误，二者不区分 |
| `401` | `ADMIN_AUTH_REQUIRED` | JWT、会话记录、期限或会话世代无效 |
| `403` | `ORIGIN_NOT_ALLOWED` | 请求来源不是 `https://apollo.example.com` |
| `403` | `CSRF_VALIDATION_FAILED` | 有效会话的写请求缺少或携带错误 CSRF 令牌 |
| `403` | `CURRENT_PASSWORD_INVALID` | 修改密码时当前密码错误 |
| `409` | `ADMIN_CREDENTIAL_UNCHANGED` | 新密码与当前密码相同 |
| `409` | `ADMIN_CREDENTIAL_CONFLICT` | 验证后管理员凭据或会话世代已被并发修改 |
| `413` | `PAYLOAD_TOO_LARGE` | 请求正文超过 `8 KiB` 上限 |
| `415` | `UNSUPPORTED_MEDIA_TYPE` | 需要 JSON 正文但媒体类型不受支持 |
| `429` | `ADMIN_LOGIN_THROTTLED` | 来源 IP 或登录名桶处于冷却期 |
| `503` | `SERVICE_UNAVAILABLE` | MongoDB 等必要依赖暂时不可用 |
| `500` | `INTERNAL_ERROR` | 未预期的服务端错误 |

- 系统尚未初始化管理员时，登录仍返回 `ADMIN_CREDENTIALS_INVALID`，不公开初始化状态。
- `ADMIN_AUTH_REQUIRED` 仅在确定管理会话无效时清除 Cookie；`SERVICE_UNAVAILABLE` 和 `INTERNAL_ERROR` 不清除 Cookie。
- `ADMIN_LOGIN_THROTTLED` 不返回触发维度、剩余次数或精确解除时间。
- `INTERNAL_ERROR` 只返回通用中文提示和 `requestId`。

| 方法与路径 | 职责 | 认证要求 |
| --- | --- | --- |
| `POST /login` | 使用登录名和密码建立管理会话 | 无管理会话；校验精确来源并执行登录限速 |
| `GET /session` | 恢复并读取当前管理会话 | 有效管理会话 |
| `POST /logout` | 撤销当前管理会话并清除 Cookie | 有效管理会话及 CSRF 令牌 |
| `PATCH /password` | 再次验证当前密码后修改密码 | 有效管理会话及 CSRF 令牌 |

- 管理端只提供密码修改能力；登录名只能通过受信恢复 CLI 变更。修改密码或执行访问恢复成功后递增 `sessionGeneration` 并撤销全部管理会话。
- MVP 不提供公开初始化、访问恢复、管理员创建、会话列表或退出全部设备 API。
- 初始化与访问恢复只由部署主机上的后端 CLI 承担。


### 登录契约

`POST /admin/auth/login` 请求体：

```json
{
  "username": "normalized-name",
  "password": "管理员密码"
}
```

成功时返回 `200`：

```json
{
  "admin": {
    "id": "primary-admin",
    "username": "normalized-name"
  },
  "session": {
    "idleExpiresAt": "ISO 8601 时间",
    "absoluteExpiresAt": "ISO 8601 时间"
  },
  "serverTime": "ISO 8601 时间",
  "csrfToken": "随机令牌"
}
```

- 成功响应设置 `__Host-admin_session=<JWT>` Cookie，属性固定为 `Path=/; HttpOnly; Secure; SameSite=Strict`，不设置 `Domain`。
- JWT 不进入 JSON 响应，管理端不把 JWT 或 CSRF 令牌写入任何浏览器持久化存储。
- 响应设置 `Cache-Control: no-store`。
- 管理端使用凭据模式发起请求，API 只允许 `https://apollo.example.com` 读取响应。
- 登录名由服务端按已确认规则规范化；密码按原始输入执行已确认的 NFC 规范化和完整校验。

### 会话恢复契约

`GET /admin/auth/session` 在管理会话有效时返回与登录成功相同的 `admin`、`session`、`serverTime` 和 `csrfToken` 结构。

- 请求按 5 分钟活动采样规则决定是否延长 `idleExpiresAt`，响应始终返回 MongoDB 中的权威期限。
- 请求不签发新 JWT、不轮换 CSRF 令牌，也不要求 CSRF 请求头；API 仍只允许 `https://apollo.example.com` 读取响应。
- JWT 缺失、格式错误、签名无效、已过期、会话记录不存在、空闲过期或 `sessionGeneration` 不匹配时返回 `401`，并清除管理会话 Cookie。
- MongoDB 或后端暂时不可用时返回服务失败且不清除 Cookie；管理端提供重试入口，不把基础设施故障误判为退出登录。
- 响应设置 `Cache-Control: no-store`。

### 退出契约

`POST /admin/auth/logout` 始终校验精确 `Origin`。

- 当前管理会话有效时必须校验 CSRF 令牌，然后删除对应管理会话记录。
- 撤销成功返回 `204 No Content`，并通过过期的 `Set-Cookie` 清除 `__Host-admin_session`。
- 管理会话已经过期、已删除或 Cookie 已缺失时，同样返回 `204` 并清除 Cookie，使网络重试保持幂等。
- 当前管理会话仍有效但 CSRF 令牌错误时返回 `403`，不撤销会话。
- MongoDB 暂时不可用、无法确认服务端会话已撤销时返回服务失败且不清除 Cookie，管理端提示重试。
- 只有管理会话实际从有效变为已撤销时记录一次成功退出审计；重复请求不重复生成成功审计。

### 修改密码契约

`PATCH /admin/auth/password` 请求体：

```json
{
  "currentPassword": "当前密码",
  "newPassword": "新密码"
}
```

- 请求必须具有有效管理会话、正确 CSRF 令牌和精确来源。
- 服务端先验证当前密码；验证失败时不执行或暴露新密码的其他校验结果。
- 新密码执行 NFC 规范化、长度校验和弱密码阻止名单检查；规范化后与当前密码相同时返回业务冲突且不修改数据。
- 更新以当前 `sessionGeneration` 为并发前提；验证后管理员凭据已被其他操作改变时返回业务冲突。
- 成功时在一次管理员文档原子更新中写入新的 `Argon2id` 散列并递增 `sessionGeneration`。
- 成功返回 `204 No Content`，清除管理会话 Cookie，并要求使用新密码重新登录。
- 当前密码错误时返回稳定业务错误，不修改管理会话或登录限速桶。
- 当前切片不维护再次验证失败次数、不设置再次验证冷却、不因当前密码错误自动撤销会话，也不增加统一管理 API 请求限速；该路径只依靠有效管理会话、CSRF 防护和 `Argon2id` 计算成本。
- 当前密码验证失败写入安全审计摘要，但不记录密码、JWT 或 CSRF 令牌。
- 本方案明确接受持有有效管理会话及 CSRF 令牌的人可以持续尝试当前密码，并可能造成额外计算消耗的风险，以保持 MVP 简单。

## 管理员密码散列

- 管理员密码使用 `Argon2id` 散列，最低参数为内存 `19 MiB`、迭代 `2` 次、并行度 `1`。
- 使用成熟实现自动为每次散列生成独立盐，并以 PHC 格式保存算法、参数、盐和散列结果。
- 每次登录成功后检查已存参数；安全基线提高时，使用本次已验证的明文密码自动重新散列。
- 上线前必须在目标云主机实测密码校验耗时，单次校验保持在 1 秒以内；参数可以提高，但不得低于上述基线。
- MVP 不使用全局 `pepper`，避免引入额外的秘密轮换和访问恢复复杂度。

## 管理员密码规则

- 密码长度为 15～128 个 Unicode 码点。
- 接受空格、中文和其他 Unicode 字符；初始化、恢复、修改和登录校验均在散列前执行 NFC 规范化。
- 不设置大小写、数字或特殊字符组合规则，不自动去除首尾空格，也不截断密码。
- 初始化、恢复或修改密码时，对完整密码执行本地弱密码阻止名单检查。后端随版本内置一份固定版本的 NCSC/HIBP Top 100,000 密码 SHA-256 列表，启动时加载，运行时不联网下载或查询第三方服务。
- 常见泄露密码匹配以 NFC 规范化后的完整密码为输入，计算 SHA-256 后精确查表；另行拒绝由规范化管理员登录名、项目名 `comic-strip` 以及生产域名 `apollo.example.com`、`apis.example.com` 派生的明显上下文密码。
- 阻止名单作为受版本控制的安全资源手动升级；文件必须记录上游来源、数据版本或获取日期及完整性校验值，不启用运行时自动更新。
- 不要求定期更换密码，也不维护密码历史；仅在管理员主动修改、访问恢复或发现凭据泄露时更换。
- 不提供密码提示或安全问题。

## 管理员登录名规则

- 登录名长度为 3～64 个字符，只允许小写英文字母、数字、点、下划线和连字符，并且必须以字母或数字开头和结尾。
- 初始化、登录和访问恢复时先去除登录名首尾空白，再统一转为小写；登录按规范化结果精确匹配，因此输入大小写不敏感。
- 登录名只允许通过管理员访问恢复变更，不是管理员身份主键；变更登录名不创建新的管理员身份。
- 邮箱、手机号和微信身份不作为登录名的特殊类型，也不增加对应验证流程。

## 唯一管理员聚合

- 管理员聚合使用固定字符串 `_id = "primary-admin"`，完整理由见 [ADR-0006](../adr/0006-fixed-primary-admin-id.md)。
- 管理员集合通过数据库级 JSON Schema 校验只允许该 `_id`，并依靠 MongoDB 的 `_id` 唯一约束保证最多一个管理员文档。
- JWT 的 `sub` 和管理会话的管理员引用固定使用 `"primary-admin"`；登录名修改不改变管理员身份。
- 初始化 CLI 只允许插入；管理员已存在时明确失败，不覆盖也不静默成功。
- 恢复 CLI 只允许更新；管理员不存在或集合数据违反单例约束时拒绝继续。

### 管理员数据模型

MongoDB 集合 `admins` 使用以下最小字段：

```json
{
  "_id": "primary-admin",
  "username": "规范化登录名",
  "passwordHash": "Argon2id PHC 字符串",
  "sessionGeneration": 1,
  "createdAt": "MongoDB Date",
  "updatedAt": "MongoDB Date"
}
```

- 数据库 JSON Schema 要求上述字段并拒绝额外字段，`_id` 只允许 `"primary-admin"`。
- `sessionGeneration` 从 `1` 开始，只能单调递增。
- `updatedAt` 覆盖密码修改和访问恢复时间，不增加含义重复的密码或凭据更新时间字段。
- 不使用 Mongoose `__v`；凭据并发控制统一依靠 `sessionGeneration`。
- 不增加状态、角色、权限数组、邮箱、手机号、显示名、恢复令牌或删除字段。
- 只有一个固定管理员，不为 `username` 建立唯一索引。

### 初始化 CLI

受信部署主机通过以下命令初始化唯一管理员：

```text
npm run admin:init
```

- 命令只允许在可交互终端运行，拒绝非 TTY 调用；登录名和密码不得通过命令参数、环境变量或标准输入管道传递。
- 连接配置中的 MongoDB 后，先确保管理员集合校验规则和必要索引已经就绪。
- 先检查 `"primary-admin"` 是否存在；已存在时立即失败，不询问凭据、不覆盖数据。
- 交互式询问登录名、密码和密码确认，密码输入不回显；凭据使用与 API 相同的规范化、格式和弱密码阻止名单校验。
- 使用 `Argon2id` 生成散列，并插入 `sessionGeneration = 1` 的管理员文档；并发执行依靠固定 `_id` 保证最多一个命令成功。
- 成功以退出码 `0` 结束；配置、依赖、校验或管理员已存在均以非零退出码结束。
- 输出只包含中文结果、规范化登录名和 `requestId`，不输出密码、散列、JWT、连接串或秘密配置。

### 访问恢复 CLI

受信部署主机通过以下命令恢复唯一管理员访问：

```text
npm run admin:recover
```

- 命令只允许在可交互终端运行，凭据不得通过参数、环境变量或标准输入管道传递。
- 管理员不存在时失败，不能替代初始化命令创建管理员。
- 命令显示当前规范化登录名，并要求输入固定确认短语“恢复唯一管理员访问”。
- 命令询问新登录名，留空表示保持当前登录名；无论登录名是否变化，都必须输入并确认一个新密码，不能读取或展示旧密码。
- 新凭据执行与初始化和 API 相同的规范化、格式、弱密码阻止名单与 `Argon2id` 处理。
- 更新以读取到的 `sessionGeneration` 为并发前提，原子更新登录名、密码散列、`updatedAt` 并递增世代；发生并发变化时失败并要求重新执行。
- 成功后全部旧会话立即失效，旧会话记录随后清理；CLI 不自动创建新会话。
- 成功只输出新规范化登录名、会话已撤销提示和 `requestId`，不输出任何秘密。

## 完成门槛

- 后端全部 `node:test` 单元测试、真实 MongoDB 集成测试和 HTTP 契约测试通过，不允许以跳过测试替代依赖准备。
- 管理端 lint、Jest 测试和生产构建全部通过。
- Playwright Chromium 使用真实管理端、真实 Koa 服务和真实随机 MongoDB 测试数据库完成已冻结的端到端路径，测试不得拦截认证 API 或复用持久化认证状态。
- 在一次性测试数据库上实际执行初始化 CLI 和访问恢复 CLI 冒烟验证，覆盖管理员存在/不存在、凭据校验、会话世代递增和安全输出。
- 使用生产模式配置执行启动冒烟验证，至少证明弱 JWT 密钥会导致启动失败、允许来源固定为 `https://apollo.example.com`，且登录响应签发生产 `__Host-admin_session` Cookie 安全属性。
- 上述任一检查失败、被跳过或仅由 mock 代替时，当前切片不得标记完成。

## 冻结结论

用户已确认将本 Spec 冻结为第一切片“管理员访问与运行基线”的架构与跨端契约。后续实现必须遵守本文范围、阶段门槛和真实联调要求；新增能力或改变安全取舍时，应先重新打开相应决策并同步更新本文、`CONTEXT.md` 与必要 ADR。
