# admin-web API 规范

## 一、通用约定

- 请求工具统一使用 `admin-web/src/utils/request.js` 导出的 `request` 实例。
- API 封装统一放在 `admin-web/src/api`，按业务域拆分文件，并在 `admin-web/src/api/index.js` 统一导出。
- API 文件统一采用类实例导出风格：

```js
import request from '../utils/request';

/**
 * 业务域相关 API
 */
class ExampleAPI {
  basePath = '/admin/example';

  /**
   * 获取列表
   * @param {Object} [params]
   */
  get(params) {
    return request.get(this.basePath, { params });
  }
}

export const exampleAPI = new ExampleAPI();
```

- 管理端请求统一使用 Cookie 凭据模式。请求层不得设置 `Authorization`；CORS 也不允许该请求头。
- 管理 JWT 只存在于 API 主机设置的 `HttpOnly` Cookie 中，不进入 JSON 响应。管理端不得读取 JWT，也不得把 JWT、CSRF 令牌或密码写入 `localStorage`、`sessionStorage`、Redux、URL 或其他浏览器持久化位置。
- 认证 API 成功响应使用本节定义的原始 JSON 结构或 `204 No Content`，不增加统一成功外壳。后续内容运营 API 的业务响应继续使用：

```json
{
  "code": "OK",
  "data": null,
  "message": ""
}
```

- 业务失败以 HTTP 状态码和响应体的 `code` 判断；`message` 只用于安全展示，不参与流程判断。
- 所有认证成功与失败响应均设置 `Cache-Control: no-store`。错误响应统一包含稳定 `code`、中文 `message` 和 `requestId`；前端不得解析 `message` 决定流程。

## 二、管理员认证

认证 API 基础路径为 `/admin/auth`。生产 API 地址为 `https://apis.example.com`，管理端来源为 `https://apollo.example.com`；本地开发地址分别为 `http://localhost:40001` 和 `http://localhost:4000`。

### 会话、Cookie 与 CSRF

- 生产 Cookie 名为 `__Host-admin_session`，属性固定为 `Path=/; HttpOnly; Secure; SameSite=Strict`；开发 Cookie 名为 `admin_session`，属性为 `Path=/; HttpOnly; SameSite=Strict`。两者均不设置 `Domain`。
- 管理会话空闲期限为 30 分钟，绝对期限为 12 小时；活动最多每 5 分钟持久化一次，JWT 不刷新。普通退出只撤销当前会话；修改密码和访问恢复撤销全部会话。
- 登录与会话恢复响应返回会话绑定的 `csrfToken`。请求层只在私有内存中保存该值；所有已认证写请求通过 `X-CSRF-Token` 发送。会话恢复不要求该请求头，也不轮换令牌。
- `admin-session-token` 不是有效持久化键；请求层不得读取、写入或兼容该旧约定。
- 请求层只有收到确定的 `401 ADMIN_AUTH_REQUIRED` 时才清除内存 CSRF 令牌；`503 SERVICE_UNAVAILABLE` 和 `500 INTERNAL_ERROR` 不得当作退出登录，也不得主动清除 Cookie 语义。

### CORS 与默认拒绝

- `/admin/**` 请求必须携带精确匹配当前环境管理端来源的 `Origin`。只允许 `GET`、`POST`、`PATCH`、`OPTIONS` 及 `Content-Type`、`X-CSRF-Token`，凭据型 CORS 响应使用精确来源、`Access-Control-Allow-Credentials: true`、`Vary: Origin`，并通过 `Access-Control-Expose-Headers` 暴露 `X-Request-ID`；预检缓存 10 分钟。
- 公开白名单只有健康检查、`POST /admin/auth/login` 和合法预检。除登录外，管理路由默认要求有效管理会话；所有已认证写请求默认要求 CSRF 校验。
- 未认证访问未知 `/admin/**` 路径返回 `401 ADMIN_AUTH_REQUIRED`，认证后访问未知路径才返回 `404`。管理会话不能由小程序业务会话替代。
- 来源缺失或不匹配返回 `403 ORIGIN_NOT_ALLOWED`，且不返回允许跨域读取的 CORS 头。

### 请求正文

- 需要正文的认证端点只接受 UTF-8 `application/json`，解码后上限为 `8 KiB`；不支持压缩正文、表单编码或文件上传。
- 登录只允许 `username`、`password`；修改密码只允许 `currentPassword`、`newPassword`。缺失字段、未知字段、类型错误或非法 JSON 返回 `400 VALIDATION_ERROR`。
- 会话恢复和退出不接受请求正文；携带正文返回 `400 VALIDATION_ERROR`。正文超限返回 `413 PAYLOAD_TOO_LARGE`，媒体类型错误返回 `415 UNSUPPORTED_MEDIA_TYPE`。

### 端点契约

| 方法与路径 | 请求 | 成功结果 | 权限边界 |
| --- | --- | --- | --- |
| `POST /admin/auth/login` | `{ username, password }` | `200`，返回认证会话结构并设置会话 Cookie | 无管理会话；精确来源、登录限速 |
| `GET /admin/auth/session` | 无正文 | `200`，返回认证会话结构 | 有效管理会话；不要求 CSRF |
| `POST /admin/auth/logout` | 无正文 | `204 No Content`，清除会话 Cookie | 精确来源；有效会话时要求 CSRF；无会话时幂等成功 |
| `PATCH /admin/auth/password` | `{ currentPassword, newPassword }` | `204 No Content`，清除会话 Cookie | 有效管理会话、精确来源、CSRF |

登录和会话恢复的认证会话结构固定为：

```json
{
  "admin": {
    "id": "primary-admin",
    "username": "normalized-name"
  },
  "session": {
    "idleExpiresAt": "带毫秒和 Z 后缀的 RFC 3339 UTC 时间",
    "absoluteExpiresAt": "带毫秒和 Z 后缀的 RFC 3339 UTC 时间"
  },
  "serverTime": "带毫秒和 Z 后缀的 RFC 3339 UTC 时间",
  "csrfToken": "随机令牌"
}
```

- `POST /admin/auth/login` 的登录名由服务端先去除首尾空白并转为小写；密码按原始输入执行 NFC 规范化。管理员未初始化、登录名不存在或密码错误统一返回 `401 ADMIN_CREDENTIALS_INVALID`。成功响应设置会话 Cookie，不返回 JWT 或会话令牌字段。
- `GET /admin/auth/session` 返回 MongoDB 中的权威期限，不签发新 JWT、不轮换 CSRF 令牌。JWT 或服务端会话确定无效时返回 `401 ADMIN_AUTH_REQUIRED` 并清除 Cookie；依赖故障时不清除 Cookie。
- `POST /admin/auth/logout` 始终校验精确来源。有效会话必须通过 CSRF 后删除当前 `jti` 对应的会话；Cookie 缺失、会话过期或记录已删除时仍返回 `204` 并清除 Cookie。有效会话的 CSRF 错误返回 `403 CSRF_VALIDATION_FAILED` 且不撤销会话；无法确认服务端撤销时返回服务失败且不清除 Cookie。
- `PATCH /admin/auth/password` 先验证当前密码，再校验新密码；当前密码错误时不暴露新密码的其他校验结果。新密码执行 NFC 规范化、15～128 个 Unicode 码点校验和弱密码阻止名单检查。成功原子更新密码散列、递增 `sessionGeneration`、撤销全部会话并要求重新登录。
- 管理端不提供公开初始化、访问恢复、管理员创建、登录名修改、会话列表或退出全部设备 API；初始化和访问恢复只允许受信部署主机上的后端 CLI。

### 稳定错误码

错误响应格式：

```json
{
  "code": "ADMIN_AUTH_REQUIRED",
  "message": "管理会话已失效，请重新登录",
  "requestId": "请求追踪标识"
}
```

表单校验失败可以额外返回 `fieldErrors`；登录失败、当前密码错误、登录限速和会话错误不得返回诊断细节。

| HTTP | `code` | 使用场景 |
| ---: | --- | --- |
| `400` | `VALIDATION_ERROR` | 请求体、登录名或新密码格式不合法 |
| `401` | `ADMIN_CREDENTIALS_INVALID` | 登录名不存在、密码错误或管理员未初始化，三者不区分 |
| `401` | `ADMIN_AUTH_REQUIRED` | JWT、会话记录、期限或会话世代无效 |
| `403` | `ORIGIN_NOT_ALLOWED` | 请求来源缺失或不匹配 |
| `403` | `CSRF_VALIDATION_FAILED` | 有效会话的写请求缺少或携带错误 CSRF 令牌 |
| `403` | `CURRENT_PASSWORD_INVALID` | 修改密码时当前密码错误 |
| `409` | `ADMIN_CREDENTIAL_UNCHANGED` | 新密码与当前密码相同 |
| `409` | `ADMIN_CREDENTIAL_CONFLICT` | 验证后管理员凭据或会话世代被并发修改 |
| `413` | `PAYLOAD_TOO_LARGE` | 请求正文超过 `8 KiB` |
| `415` | `UNSUPPORTED_MEDIA_TYPE` | 需要 JSON 正文但媒体类型不受支持 |
| `429` | `ADMIN_LOGIN_THROTTLED` | 来源 IP 或登录名桶处于冷却期 |
| `503` | `SERVICE_UNAVAILABLE` | MongoDB 等必要依赖暂时不可用 |
| `500` | `INTERNAL_ERROR` | 未预期的服务端错误 |

`ADMIN_LOGIN_THROTTLED` 不返回触发维度、剩余次数或精确解除时间；`INTERNAL_ERROR` 只返回通用中文提示和 `requestId`。

## 三、内容运营

> 阶段门禁：本节及后续 COS 图片直传记录后续业务切片的预定接口契约，不属于 Issue #18“管理员访问与运行基线”的当前生效路由，当前基线不得提供或调用这些端点。本文件仍是这些后续接口的唯一契约事实源；未来实施票启用任一端点前，必须先重新冻结并同步当前 CORS 方法白名单。尤其是 `DELETE` 等超出 Issue #18 当前 `GET`、`POST`、`PATCH`、`OPTIONS` 白名单的方法，在白名单完成契约同步前不得启用。

所有以下接口均需要管理员会话。列表接口的游标参数为 `cursor`、`limit`，成功结果为 `{ items, nextCursor }`。

| 资源 | 列表与新增 | 编辑与删除 | 载荷 |
| --- | --- | --- | --- |
| 主题标签 | `GET`、`POST /admin/tags` | `PATCH`、`DELETE /admin/tags/:tagId` | `{ name, sortOrder }` |
| 漫画系列 | `GET`、`POST /admin/series` | `PATCH`、`DELETE /admin/series/:seriesId` | `{ name, summary, authorByline }` |
| 漫画单话 | `GET`、`POST /admin/episodes` | `PATCH`、`DELETE /admin/episodes/:episodeId` | `{ seriesId, title, summary?, themeTagId, panels: [{ position, imageUrl, altText? }] }` |
| 运营专题 | `GET`、`POST /admin/topics` | `GET`、`PATCH`、`DELETE /admin/topics/:topicId` | `{ title, summary?, coverImageUrl, episodeIds }` |
| 评论处置 | `GET /admin/comments?cursor=&limit=1..50&view=active\|deleted` | `DELETE /admin/comments/:commentId` | 列表返回 `{ items, nextCursor }`；删除返回 `{ deleted: true }` |

- 单话状态流转：`POST /admin/episodes/:episodeId/publish`、`POST /admin/episodes/:episodeId/unpublish`。
- 仅草稿可删除；已发布单话必须先下架才可编辑。发布前必须存在顺序固定的四个画格。
- 专题的 `episodeIds` 数组顺序即读者端展示顺序；只允许收录已发布单话。
- 评论处置列表默认 `view=active`，可查询 `active` 或 `deleted`；单项为 `{ id, content, createdAt, author: { id: string|null, displayName: string|null, avatarUrl: string|null }, episode: { id: string|null, title: string|null, status: string|null }, audit: null|{ deletedAt, deletedBy: { role, id } } }`。关联读者或单话已不存在时保留可用原 ID，无法取得时返回 `null`；已删除视图保留原软删除审计信息。
- 评论处置接口的非法查询参数或评论 ID 返回 `400 VALIDATION_ERROR`；缺失、失效或非管理员会话返回 `401 ADMIN_AUTH_REQUIRED`。
- `DELETE /admin/comments/:commentId` 不受单话发布状态限制；不存在返回 `404 RESOURCE_NOT_FOUND`，已删除返回 `409 COMMENT_ALREADY_DELETED`，且不覆盖原审计记录。

## 四、COS 图片直传

1. 调用 `POST /admin/cos/presign`，请求体为 `{ fileName, contentType, contentLength }`。
2. 仅允许 `image/jpeg`、`image/png`、`image/webp`，单文件最大 5 MB。
3. 使用返回的 `{ method, uploadUrl, headers }` 向 `uploadUrl` 发起原始二进制 `PUT` 请求；成功后仅持久化返回的 `publicUrl`。
