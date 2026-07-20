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

- 登录后请求自动携带 `Authorization: Bearer ${token}`。
- 后端业务响应统一为：

```json
{
  "code": "OK",
  "data": null,
  "message": ""
}
```

- 业务失败以 HTTP 状态码和响应体的 `code`、`message` 判断；页面不得只依赖 HTTP 状态。
- 登录令牌持久化键为 `admin-session-token`，请求层自动追加 `Authorization: Bearer ${token}`。

## 二、管理员认证

| 方法 | 路径 | 请求体 | 成功数据 |
| --- | --- | --- | --- |
| `POST` | `/admin/auth/login` | `{ username, password }` | `{ admin: { username }, sessionToken, expiresAt }` |
| `POST` | `/auth/logout` | 无 | `{}` |

## 三、内容运营

所有以下接口均需要管理员会话。列表接口的游标参数为 `cursor`、`limit`，成功结果为 `{ items, nextCursor }`。

| 资源 | 列表与新增 | 编辑与删除 | 载荷 |
| --- | --- | --- | --- |
| 主题标签 | `GET`、`POST /admin/tags` | `PATCH`、`DELETE /admin/tags/:tagId` | `{ name, sortOrder }` |
| 漫画系列 | `GET`、`POST /admin/series` | `PATCH`、`DELETE /admin/series/:seriesId` | `{ name, summary, authorByline }` |
| 漫画单话 | `GET`、`POST /admin/episodes` | `PATCH`、`DELETE /admin/episodes/:episodeId` | `{ seriesId, title, summary?, themeTagId, panels: [{ position, imageUrl, altText? }] }` |
| 运营专题 | `GET`、`POST /admin/topics` | `GET`、`PATCH`、`DELETE /admin/topics/:topicId` | `{ title, summary?, coverImageUrl, episodeIds }` |

- 单话状态流转：`POST /admin/episodes/:episodeId/publish`、`POST /admin/episodes/:episodeId/unpublish`。
- 仅草稿可删除；已发布单话必须先下架才可编辑。发布前必须存在顺序固定的四个画格。
- 专题的 `episodeIds` 数组顺序即读者端展示顺序；只允许收录已发布单话。

## 四、COS 图片直传

1. 调用 `POST /admin/cos/presign`，请求体为 `{ fileName, contentType, contentLength }`。
2. 仅允许 `image/jpeg`、`image/png`、`image/webp`，单文件最大 5 MB。
3. 使用返回的 `{ method, uploadUrl, headers }` 向 `uploadUrl` 发起原始二进制 `PUT` 请求；成功后仅持久化返回的 `publicUrl`。
