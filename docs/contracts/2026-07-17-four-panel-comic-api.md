# 四格漫画 API 契约

日期：2026-07-17  
状态：已确认；除明确说明外，所有路径以 `/api/v1` 为前缀。

## 1. 通用约定

请求和响应使用 JSON，文件直传 COS 的 `PUT` 请求除外。读者会话和管理员会话均使用：

```http
Authorization: Bearer <sessionToken>
```

两类令牌不能互用。列表查询采用游标分页：`limit` 默认 20、最大 50，响应为 `{ items, nextCursor }`，末页 `nextCursor` 为 `null`。时间字段为 ISO 8601 UTC 字符串。

成功响应：

```json
{ "code": "OK", "message": "", "data": {} }
```

失败响应：

```json
{ "code": "业务错误码", "message": "中文错误语义", "data": null }
```

HTTP 状态表达协议类别；客户端必须以 `code` 判断业务结果。以下错误码为本期稳定语义：

| HTTP | `code` | 中文语义 |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | 请求参数不合法。 |
| 401 | `READER_AUTH_REQUIRED` | 请先微信登录后再操作。 |
| 401 | `ADMIN_AUTH_REQUIRED` | 请先登录管理后台。 |
| 403 | `FORBIDDEN` | 无权执行此操作。 |
| 404 | `RESOURCE_NOT_FOUND` | 内容不存在或已不可用。 |
| 409 | `DUPLICATE_ACTION` | 已执行过该操作。 |
| 409 | `ACTION_NOT_FOUND` | 尚未执行该操作，无法取消。 |
| 409 | `EPISODE_EDIT_REQUIRES_UNPUBLISH` | 已发布单话必须先下架后再修改。 |
| 409 | `INVALID_EPISODE_STATUS_TRANSITION` | 当前单话状态不允许此操作。 |
| 409 | `EPISODE_INCOMPLETE` | 单话必须恰好包含 4 个有序画格才可发布。 |
| 409 | `RESOURCE_DELETE_FORBIDDEN` | 当前资源不满足删除条件。 |
| 409 | `TAG_IN_USE` | 标签已被单话使用，无法删除。 |
| 422 | `INVALID_COS_PUBLIC_URL` | 图片地址不是允许的 COS 公网 HTTPS 地址。 |
| 429 | `RATE_LIMITED` | 操作过于频繁，请稍后重试。 |

公开内容端点遇到下架单话时一律返回 `RESOURCE_NOT_FOUND`；不返回状态细节。

## 2. 核心响应对象

### `EpisodeSummary`

```json
{
  "id": "episodeId",
  "series": { "id": "seriesId", "name": "系列名", "authorByline": "作者署名" },
  "title": "单话标题",
  "themeTag": { "id": "tagId", "name": "主题标签" },
  "thumbnailUrl": "https://cos.example.com/path/panel-1.jpg",
  "publishedAt": "2026-07-17T00:00:00.000Z",
  "counts": { "likeCount": 0, "favoriteCount": 0, "commentCount": 0, "shareCount": 0 }
}
```

### `EpisodeDetail`

在 `EpisodeSummary` 基础上增加：

```json
{
  "summary": "可为空",
  "panels": [
    { "position": 1, "imageUrl": "https://cos.example.com/path/1.jpg", "altText": "可为空" },
    { "position": 2, "imageUrl": "https://cos.example.com/path/2.jpg", "altText": "可为空" },
    { "position": 3, "imageUrl": "https://cos.example.com/path/3.jpg", "altText": "可为空" },
    { "position": 4, "imageUrl": "https://cos.example.com/path/4.jpg", "altText": "可为空" }
  ],
  "viewerState": { "isLiked": false, "isFavorited": false },
  "readerFlow": { "previousEpisodeId": "可为空", "nextEpisodeId": "可为空" }
}
```

`readerFlow` 以首页发布时间倒序流为准；匿名读者的 `viewerState` 固定为 `false`。

### `Comment`

```json
{
  "id": "commentId",
  "episodeId": "episodeId",
  "content": "1-200 字符的一级纯文本",
  "createdAt": "2026-07-17T00:00:00.000Z",
  "author": { "id": "readerId", "displayName": "读者昵称", "avatarUrl": "https://example.com/avatar.png" },
  "likeCount": 0,
  "viewerState": { "isLiked": false, "canDelete": false }
}
```

## 3. 认证

| 方法与路径 | 认证 | 请求字段 | 关键响应字段 |
| --- | --- | --- | --- |
| `POST /auth/wechat/login` | 匿名 | `code`：微信临时登录凭证，必填；`profile?`：经用户授权的 `{displayName,avatarUrl}`。 | `reader:{id,displayName,avatarUrl,createdAt}`、`sessionToken`、`expiresAt`。后端交换凭证、建档/复用读者；仅在提供授权资料时同步昵称与头像后签发系统会话。 |
| `POST /admin/auth/login` | 匿名 | `username`、`password`，均必填。 | `admin:{username}`、`sessionToken`、`expiresAt`。账号与密码哈希只从后端环境变量校验。 |
| `POST /auth/logout` | 已登录读者或管理员 | 无。 | 空对象；当前会话失效。 |

微信凭证交换失败返回 `401 WECHAT_LOGIN_FAILED`，语义为“微信登录已失效，请重新登录”。管理员凭证不正确返回 `401 ADMIN_LOGIN_FAILED`，语义为“账号或密码错误”。

## 4. 读者端公开读取

| 方法与路径 | 认证 | 查询/请求字段 | 关键响应字段 |
| --- | --- | --- | --- |
| `GET /episodes` | 可选读者 | `cursor?`、`limit?`。 | `items: EpisodeSummary[]`、`nextCursor`；仅已发布单话，发布时间倒序。 |
| `GET /episodes/:episodeId` | 可选读者 | 无。 | `EpisodeDetail`；下架内容按不存在处理。 |
| `GET /episodes/:episodeId/comments` | 可选读者 | `cursor?`、`limit?`。 | `items: Comment[]`、`nextCursor`；仅未删除评论，创建时间倒序，默认/最大值同通用约定。 |
| `GET /series` | 匿名 | `cursor?`、`limit?`。 | `items:[{id,name,summary,authorByline,thumbnailUrl,latestEpisode?}]`、`nextCursor`；`thumbnailUrl` 复用最新已发布单话首画格。 |
| `GET /series/:seriesId` | 匿名 | `cursor?`、`limit?`。 | `series:{id,name,summary,authorByline,thumbnailUrl}`、`episodes: EpisodeSummary[]`、`nextCursor`；单话仅已发布，`thumbnailUrl` 复用最新已发布单话首画格。 |
| `GET /topics` | 匿名 | `cursor?`、`limit?`。 | `items:[{id,title,summary,coverImageUrl}]`、`nextCursor`。 |
| `GET /topics/:topicId` | 匿名 | 无。 | `topic:{id,title,summary,coverImageUrl}`、`episodes: EpisodeSummary[]`；按专题管理员顺序，已下架项过滤。 |
| `GET /rankings/monthly-series` | 匿名 | `month?`，格式 `YYYY-MM`，缺省为上海时区当前月。 | `month`、`items:[{rank,series:{id,name,authorByline},heat,shareCount}]`；按热度、分享数、系列 `id` 排序。 |

## 5. 读者互动与“我”

以下写操作均要求已登录读者，且目标单话必须已发布、目标评论必须未删除且所属单话已发布。

| 方法与路径 | 请求字段 | 关键响应字段 | 规则 |
| --- | --- | --- | --- |
| `POST /episodes/:episodeId/likes` | 无。 | `isLiked:true`、`likeCount`。 | 同读者同单话唯一；重复返回 `DUPLICATE_ACTION`。 |
| `DELETE /episodes/:episodeId/likes` | 无。 | `isLiked:false`、`likeCount`。 | 未点赞取消返回 `ACTION_NOT_FOUND`。 |
| `POST /episodes/:episodeId/favorites` | 无。 | `isFavorited:true`、`favoriteCount`。 | 同读者同单话唯一。 |
| `DELETE /episodes/:episodeId/favorites` | 无。 | `isFavorited:false`、`favoriteCount`。 | 未收藏取消返回 `ACTION_NOT_FOUND`。 |
| `POST /episodes/:episodeId/shares` | 无；读者令牌可选。 | `shareCount`。 | 每一次请求都新增一条分享计数，不去重；匿名也允许。 |
| `POST /episodes/:episodeId/comments` | `content`：1-200 字符一级纯文本。 | `comment: Comment`、`commentCount`。 | 允许 emoji、换行；拒绝图片、链接和 `@` 回复语义。 |
| `DELETE /comments/:commentId` | 无。 | `deleted:true`。 | 评论作者可删除自己；管理员可删除任意评论；均为逻辑删除。 |
| `POST /comments/:commentId/likes` | 无。 | `isLiked:true`、`likeCount`。 | 同读者同评论唯一。 |
| `DELETE /comments/:commentId/likes` | 无。 | `isLiked:false`、`likeCount`。 | 未点赞取消返回 `ACTION_NOT_FOUND`。 |
| `GET /me` | 无。 | `reader:{id,displayName,avatarUrl,createdAt}`。 | 用于确认读者登录态。 |
| `GET /me/favorites` | `cursor?`、`limit?`。 | `items: EpisodeSummary[]`、`nextCursor`。 | 收藏创建时间倒序；下架单话过滤。 |
| `GET /me/episode-likes` | `cursor?`、`limit?`。 | `items: EpisodeSummary[]`、`nextCursor`。 | 单话点赞创建时间倒序；评论点赞不在此处出现。 |
| `GET /me/comments` | `cursor?`、`limit?`。 | `items: Comment[]`、`nextCursor`。 | 评论创建时间倒序；已逻辑删除评论不出现。 |

分享接口唯一例外：它是读者动作但不要求登录，以满足未登录可读和微信原生分享；仍会对已下架单话返回 `RESOURCE_NOT_FOUND`。前端在微信分享回调触发时调用它。

## 6. 管理端系列、单话和专题

以下接口均要求管理员会话。列表允许 `cursor?`、`limit?`；管理列表包含非公开状态。`createdAt`、`updatedAt` 由后端写入，客户端不得传递。

### 6.1 系列

| 方法与路径 | 请求字段 | 关键响应字段/约束 |
| --- | --- | --- |
| `GET /admin/series` | 分页字段。 | 管理系列列表，含单话总数。 |
| `POST /admin/series` | `name`、`summary`、`authorByline` 必填。 | 新建 `series`。系列缩略图不单独上传。 |
| `GET /admin/series/:seriesId` | 无。 | `series`。 |
| `PATCH /admin/series/:seriesId` | 可修改 `name`、`summary`、`authorByline`。 | 更新后的 `series`。 |
| `DELETE /admin/series/:seriesId` | 无。 | `deleted:true`；存在任意单话时返回 `RESOURCE_DELETE_FORBIDDEN`。 |

### 6.2 单话

`panels` 必须是 `position` 为 1 至 4、无重复、按序传入的四项数组；每项 `imageUrl` 必填且为允许的 COS URL，`altText?` 可空。`themeTagId`、`title`、`seriesId` 必填；`themeTagId` 必须对应已有标签。

| 方法与路径 | 请求字段 | 关键响应字段/约束 |
| --- | --- | --- |
| `GET /admin/episodes` | `cursor?`、`limit?`、`status?`、`seriesId?`。 | `items` 含 `draft/published/unpublished` 状态及后台计数。 |
| `POST /admin/episodes` | `seriesId`、`title`、`themeTagId`、`panels`；`summary?`。 | 新建状态固定为 `draft` 的 `episode`。 |
| `GET /admin/episodes/:episodeId` | 无。 | 完整后台 `episode`。 |
| `PATCH /admin/episodes/:episodeId` | 可修改创建字段及 `panels`。 | 更新后的 `episode`；当状态为 `published` 时返回 `EPISODE_EDIT_REQUIRES_UNPUBLISH`。 |
| `POST /admin/episodes/:episodeId/publish` | 无。 | `episode:{id,status:"published",publishedAt}`；仅 `draft` 或 `unpublished` 且完整四格可发布。 |
| `POST /admin/episodes/:episodeId/unpublish` | 无。 | `episode:{id,status:"unpublished"}`；仅 `published` 可下架。 |
| `DELETE /admin/episodes/:episodeId` | 无。 | `deleted:true`；只允许删除 `draft`，其他状态返回 `RESOURCE_DELETE_FORBIDDEN`。 |

### 6.3 主题标签

| 方法与路径 | 请求字段 | 关键响应字段/约束 |
| --- | --- | --- |
| `GET /admin/tags` | 无。 | `items:[{id,name,sortOrder}]`，按 `sortOrder` 升序。 |
| `POST /admin/tags` | `name`、`sortOrder` 必填。 | 新建 `tag`。 |
| `PATCH /admin/tags/:tagId` | `name?`、`sortOrder?`。 | 更新后的 `tag`。 |
| `DELETE /admin/tags/:tagId` | 无。 | 未被单话引用时返回 `deleted:true`；已引用时返回 `TAG_IN_USE`。 |

### 6.4 专题

`episodeIds` 是数组且顺序即展示顺序，元素不重复；每个 ID 在保存时都必须对应已发布单话。

| 方法与路径 | 请求字段 | 关键响应字段/约束 |
| --- | --- | --- |
| `GET /admin/topics` | 分页字段。 | 管理专题列表，含编排数量。 |
| `POST /admin/topics` | `title`、`coverImageUrl` 必填；`summary?`、`episodeIds` 必填数组。 | 新建 `topic`；`coverImageUrl` 必须是允许的 COS 公开 HTTPS URL。 |
| `GET /admin/topics/:topicId` | 无。 | `topic`，含有序 `episodeIds`。 |
| `PATCH /admin/topics/:topicId` | `title?`、`summary?`、`coverImageUrl?`、`episodeIds?`。 | 更新后的 `topic`。 |
| `DELETE /admin/topics/:topicId` | 无。 | `deleted:true`；只删除专题编排，不删除单话及互动。 |

## 7. 管理端评论删除与 COS 预签名

| 方法与路径 | 请求字段 | 关键响应字段 | 规则 |
| --- | --- | --- | --- |
| `GET /admin/comments` | `cursor?`、`limit?`、`episodeId?`、`includeDeleted?`。 | `items` 包含评论内容、作者、删除审计字段，`nextCursor`。 | 管理员可审阅已删除评论；读者端永不返回已删除项。 |
| `DELETE /admin/comments/:commentId` | 无。 | `deleted:true`。 | 逻辑删除，写入 `deletedAt`、`deletedByRole:"admin"`、`deletedById`。 |
| `POST /admin/cos/presign` | `fileName`、`contentType`、`contentLength`，均必填。 | `method:"PUT"`、`uploadUrl`、`headers`、`publicUrl`、`expiresAt`。 | 后端仅接受 JPEG、PNG、WebP 且 `contentLength` 不超过 5 MB，签发短时上传地址；浏览器必须按 `method` 和 `headers` 直传 COS，单话或专题保存只使用 `publicUrl`。 |

预签名成功不表示图片已可访问；管理后台上传成功后应使用返回的 `publicUrl` 提交单话。后端在保存系列封面、单话画格、专题封面时再次校验 URL 前缀，拒绝任意第三方 URL。

## 8. 月榜计算契约

`GET /rankings/monthly-series` 的每条结果按下式计算：

```text
heat = 本月单话点赞数 + 本月评论创建数 + 本月评论点赞数 + 本月分享次数
```

四类事件每条各计 1 分，统计范围是该系列当月已发布单话；同分时以 `shareCount` 高者优先，再以系列 `id` 升序。接口返回的 `heat` 与 `shareCount` 都是该排序依据。无审核/举报且分享不去重是已知滥用风险，不在本期通过接口隐式修正。
