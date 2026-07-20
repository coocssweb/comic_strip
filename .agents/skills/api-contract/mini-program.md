# 小程序 API 规范

## 通用约定

- 请求统一通过 `mini-program/miniprogram/utils/request.js` 的 `request` 发出；页面和组件禁止直接调用 `wx.request`。
- 服务地址从 `mini-program/miniprogram/config.js` 的 `API_BASE_URL` 读取。真机与发布环境必须配置已备案的 HTTPS 域名。
- 请求成功必须同时满足 HTTP 2xx 和响应 `code === "OK"`；页面只消费响应的 `data` 字段。
- 网络失败、HTTP 失败或业务失败统一转换为中文 `Error`，由页面展示恢复提示；公开单话、系列、专题不可用时统一显示“内容暂不可用”。
- 本期公开阅读不携带读者会话；分享计数允许匿名调用。

## 公开阅读与发现

`mini-program/miniprogram/api/discovery.js` 维护以下端点；参数、响应对象与错误码以 `docs/contracts/2026-07-17-four-panel-comic-api.md` 为权威来源。

| 方法 | 路径 | 调用方法 | 页面用途 |
| --- | --- | --- | --- |
| GET | `/episodes` | `listEpisodes` | 首页已发布单话游标分页。 |
| GET | `/episodes/:episodeId` | `getEpisode` | 阅读器详情、四格画面和前后单话流向。 |
| GET | `/series` | `listSeries` | 发现页公开系列游标分页。 |
| GET | `/series/:seriesId` | `getSeries` | 系列详情和单话游标分页。 |
| GET | `/topics` | `listTopics` | 发现页运营专题游标分页。 |
| GET | `/topics/:topicId` | `getTopic` | 专题详情和管理员排序后的单话。 |
| GET | `/rankings/monthly-series` | `getMonthlyRanking` | 发现页月度热度榜。 |
| POST | `/episodes/:episodeId/shares` | `recordEpisodeShare` | 微信原生分享触发时计数。 |

## 响应字段映射

- `EpisodeSummary.series`、`themeTag` 和 `counts` 映射为单话卡片的系列名、主题标签及点赞/收藏/评论/分享计数。
- `EpisodeDetail.panels` 必须按 `position` 升序映射为阅读器横向四格；`readerFlow.previousEpisodeId` 和 `nextEpisodeId` 决定纵向切换目标。
- 系列、专题、月榜均使用后端已过滤的公开数据；前端不得根据状态字段自行补位或重排。

## 登录互动与“我的”

`mini-program/miniprogram/api/reader.js` 维护读者会话、互动与个人数据端点；令牌仅保存在本地会话，只在调用方显式声明需要读者身份时由请求层写入 `Authorization` 请求头，禁止写入日志或页面数据。

| 方法 | 路径 | 调用方法 | 页面用途 |
| --- | --- | --- | --- |
| POST | `/auth/wechat/login` | `wechatLogin` | 用户点击登录或写操作时，以微信凭证和授权资料换取读者会话。 |
| GET | `/episodes/:episodeId/comments` | `listEpisodeComments` | 阅读器评论游标分页；登录时包含当前读者的评论点赞与删除权限。 |
| POST/DELETE | `/episodes/:episodeId/likes` | `createEpisodeLike` / `deleteEpisodeLike` | 切换单话点赞并刷新状态和计数。 |
| POST/DELETE | `/episodes/:episodeId/favorites` | `createEpisodeFavorite` / `deleteEpisodeFavorite` | 切换收藏并刷新状态和计数。 |
| POST | `/episodes/:episodeId/comments` | `createComment` | 发布一级纯文本评论并刷新评论计数。 |
| DELETE | `/comments/:commentId` | `deleteComment` | 删除当前读者自己的评论。 |
| POST/DELETE | `/comments/:commentId/likes` | `createCommentLike` / `deleteCommentLike` | 切换评论点赞并刷新计数。 |
| GET | `/me/favorites` | `listMyFavorites` | “我的收藏”按收藏创建时间倒序游标分页。 |
| GET | `/me/episode-likes` | `listMyEpisodeLikes` | “我的点赞”只展示单话点赞，按创建时间倒序游标分页。 |
| GET | `/me/comments` | `listMyComments` | “我的评论”按创建时间倒序游标分页；后端过滤已删除评论和下架单话。 |

### 响应字段映射

- `EpisodeDetail.viewerState` 映射为阅读器的 `isLiked` 和 `isFavorited`；点赞或收藏接口的结果必须覆盖本地状态和对应计数。
- `Comment.author`、`likeCount`、`viewerState.isLiked` 和 `viewerState.canDelete` 映射为评论视图模型；模板不得直接依赖嵌套 API 响应。
- `READER_AUTH_REQUIRED` 表示本地会话已失效：清除读者会话，保留后端中文错误提示，并由下一次写操作重新触发微信登录。
