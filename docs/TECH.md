# 技术数据字典

本文记录管理员访问与运行基线涉及的 MongoDB 集合、校验器和索引权威边界。完整行为以 [管理员访问与运行基线 Spec](specs/admin-access-runtime-baseline.md) 和 [ADR-0001 至 ADR-0008](adr/) 为准。

## 持久化权威边界

- Mongoose Schema 负责应用侧严格字段约束，禁用隐式字段；MongoDB 集合级 JSON Schema 是最终存储防线。
- 启动阶段必须显式建立或核验本数据字典要求的校验器与索引，完成前不得监听 HTTP 端口；运行时不得由 Mongoose 静默改变权威结构。
- HTTP 控制器和领域服务不直接操作 Model；薄仓储显式封装原子条件更新、会话世代 CAS、TTL 索引语义和审计追加语义。
- MongoDB 时间字段均为 UTC `Date`。API 对外时间序列化为带毫秒和 `Z` 后缀的 RFC 3339 UTC 字符串。

## `admins`

唯一管理员聚合，固定身份主键见 [ADR-0006](adr/0006-fixed-primary-admin-id.md)。

| 字段 | 类型 | 约束 |
| --- | --- | --- |
| `_id` | 字符串 | 必填且只能为 `primary-admin` |
| `username` | 字符串 | 必填；规范化登录名 |
| `passwordHash` | 字符串 | 必填；`Argon2id` PHC 字符串 |
| `sessionGeneration` | 整数 | 必填；从 `1` 开始且只能单调递增 |
| `createdAt` | `Date` | 必填 |
| `updatedAt` | `Date` | 必填；覆盖密码修改和访问恢复时间 |

校验器要求上述字段并拒绝额外字段；不使用 Mongoose `__v`。只依赖 `_id` 的内建唯一索引，不为 `username` 建立唯一索引，也不增加状态、角色、权限、联系方式、恢复令牌或删除字段。

## `admin_sessions`

状态型管理会话记录，JWT 的 `jti` 与文档主键一一对应。

| 字段 | 类型 | 约束 |
| --- | --- | --- |
| `_id` | 字符串 | 必填；JWT 的 UUID v4 `jti` |
| `sessionGeneration` | 整数 | 必填；签发时的管理员会话世代 |
| `csrfTokenHash` | 字符串 | 必填；CSRF 令牌 SHA-256 摘要的 base64url 编码 |
| `createdAt` | `Date` | 必填 |
| `lastSeenAt` | `Date` | 必填；最近一次权威活动采样时间 |
| `idleExpiresAt` | `Date` | 必填；等于 `min(lastSeenAt + 30 分钟, absoluteExpiresAt)` |
| `absoluteExpiresAt` | `Date` | 必填；签发后 12 小时 |

校验器要求上述字段并拒绝额外字段。索引仅包含 `_id` 内建唯一索引和 `idleExpiresAt` TTL 索引；TTL 只负责最终清理，鉴权仍显式比较空闲期限和绝对期限。不得保存冗余管理员 ID、登录名、权限、IP、User-Agent、撤销时间、JWT 原文或 CSRF 令牌原文。

## `admin_login_throttles`

管理员登录的短期安全限速状态，见 [ADR-0007](adr/0007-mongodb-admin-login-throttles.md)。该集合是可丢弃的安全基础设施状态，不是管理员聚合、领域实体或永久审计。

- 每个文档只表示来源 IP 或规范化登录名其中一个独立限速桶；不使用 `IP + 登录名` 复合桶。
- 桶标识只保存使用 `SECURITY_HMAC_SECRET` 生成的 HMAC 摘要，不保存原始 IP 或登录名。
- 状态只包含实现令牌补充、失败计数、冷却等级、冷却期限、24 小时升级窗口和自动清理所必需的类型化字段；校验器拒绝原始凭据、原始来源地址、自由格式元数据和额外字段。
- 桶状态通过仓储原子更新维护。自动清理时间字段建立 TTL 索引；TTL 删除不参与请求是否限速的正确性判断。
- 来源 IP 桶和登录名桶的容量、补充速率、冷却阶梯及成功重置规则属于安全常量，以父 Spec 为唯一事实源，不开放环境配置。

父 Spec 冻结了上述状态语义和安全边界，但未冻结内部令牌桶字段名；实现前如需补充物理字段名，必须在不改变行为的前提下先同步本数据字典和 MongoDB JSON Schema，不能由 Model 静默生成。

## `security_audits`

只追加的安全审计记录，不是业务状态权威来源。审计写入失败的降级边界见 [ADR-0008](adr/0008-audit-failure-fallback.md)。

| 字段 | 类型 | 约束 |
| --- | --- | --- |
| `_id` | `ObjectId` | 必填 |
| `occurredAt` | `Date` | 必填 |
| `eventType` | 字符串枚举 | 必填；稳定安全事件枚举 |
| `outcome` | 字符串枚举 | 必填；`succeeded`、`failed` 或 `throttled` |
| `actorType` | 字符串枚举 | 必填；`anonymous`、`admin`、`trusted_operator` 或 `system` |
| `requestId` | 字符串 | 必填；请求或 CLI 追踪标识 |
| `adminId` | 字符串 | 可选；只能为 `primary-admin` |
| `sessionIdHash` | 字符串 | 可选；会话标识 HMAC 摘要 |
| `sourceIpHash` | 字符串 | 可选；来源 IP HMAC 摘要 |
| `credentialKeyHash` | 字符串 | 可选；规范化登录名 HMAC 摘要 |
| `reasonCode` | 字符串 | 可选；稳定原因码 |
| `sessionGeneration` | 整数 | 可选；相关会话世代 |
| `revocationScope` | 字符串枚举 | 可选；`current` 或 `all` |

`eventType` 只允许 `ADMIN_INITIALIZATION`、`ADMIN_LOGIN`、`ADMIN_LOGOUT`、`ADMIN_PASSWORD_CHANGE`、`ADMIN_ACCESS_RECOVERY`、`ADMIN_SESSION_REVOCATION`。校验器限制字段类型、枚举及各事件允许出现的可选字段，拒绝自由格式 `metadata` 和额外字段。

索引只建立 `occurredAt`、`requestId`、`eventType + occurredAt` 三组查询索引；`requestId` 不唯一，不设置 TTL。仓储只暴露追加能力，不提供业务更新或删除能力。

## 敏感数据禁入

所有集合、运行日志和安全审计均不得记录密码明文、密码散列以外的可逆凭据、JWT 原文、CSRF 令牌原文、Cookie、原始来源 IP、原始登录名、秘密配置或完整 MongoDB URI。`admin_sessions._id` 按会话权威模型保存原始 JWT `jti`；除此之外需要关联会话时只能保存使用独立 `SECURITY_HMAC_SECRET` 生成的摘要，审计和日志不得记录原始 `jti`。`admin_sessions.csrfTokenHash` 使用 SHA-256 摘要，不可替代为令牌原文。
