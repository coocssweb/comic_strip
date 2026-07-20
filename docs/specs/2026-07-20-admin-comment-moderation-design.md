# 管理后台评论处置设计

## 目标

管理员可查看有效评论和已删除评论的审计信息，并软删除任意评论。删除后，读者端后续请求不再返回该评论。

## 范围与风险

- 影响范围：`backend`、`admin-web`。
- 风险等级：中。新增管理员权限接口，并影响读者端评论可见性。
- 不涉及：物理删除、恢复评论、数据迁移、读者端实时推送。

## 方案选择

采用管理端专用接口：`GET /admin/comments` 和 `DELETE /admin/comments/:commentId`。

不扩展现有读者端 `DELETE /comments/:commentId`：该接口受已发布单话约束，且无法承载后台列表和审计查询。

## 接口契约

所有接口需要管理员会话，并沿用统一响应体：

```json
{ "code": "OK", "data": {}, "message": "" }
```

### 分页查询评论

`GET /admin/comments`

查询参数：

- `cursor`：可选游标。
- `limit`：可选，范围 1 至 50，默认 20。
- `view`：可选，`active` 或 `deleted`，默认 `active`。

成功数据：

```json
{
  "items": [
    {
      "id": "评论ID",
      "content": "评论正文",
      "createdAt": "ISO-8601 时间",
      "author": {
        "id": "读者ID",
        "displayName": "读者昵称",
        "avatarUrl": "头像地址或 null"
      },
      "episode": {
        "id": "单话ID",
        "title": "单话标题",
        "status": "draft | published | unpublished"
      },
      "audit": null
    }
  ],
  "nextCursor": null
}
```

已删除评论的 `audit` 为：

```json
{
  "deletedAt": "ISO-8601 时间",
  "deletedBy": {
    "role": "reader | admin",
    "id": "操作主体ID"
  }
}
```

### 删除评论

`DELETE /admin/comments/:commentId`

仅管理员可调用。成功返回 `{ "deleted": true }`，并写入已有的 `deletedAt`、`deletedByRole`、`deletedById` 字段。

错误语义：

- `400 VALIDATION_ERROR`：参数非法。
- `401 ADMIN_AUTH_REQUIRED`：缺失、失效或非管理员会话。
- `404 RESOURCE_NOT_FOUND`：评论不存在。
- `409 COMMENT_ALREADY_DELETED`：评论已删除，保留原审计记录。

## 数据与可见性

复用 `Comment` 的现有软删除审计字段，无需 Schema 迁移。新增 `{ deletedAt: 1, createdAt: -1, _id: -1 }` 索引以支持后台分页。

读者评论列表、单话详情和“我的评论”现有查询均过滤 `deletedAt: null`；因此管理员软删除后，在读者端下一次请求时立即不可见，评论计数同步减少。已停留在页面上的内容不进行实时推送或强制刷新。

## 管理端交互

- 在内容运营导航新增“评论处置”。
- 默认展示有效评论，支持切换“有效评论 / 已删除评论”。
- 列表展示评论正文、读者、所属单话和创建时间；已删除视图额外展示删除时间、操作者角色和操作者标识。
- 仅有效评论显示删除按钮；确认弹窗明确软删除影响及审计记录保留。
- 删除成功后刷新当前筛选列表；不提供新增、编辑或恢复。

## 验收与联调

1. 管理员能分页查看有效评论和已删除评论。
2. 删除后评论仍保留在本地数据库，审计字段完整。
3. 读者端重新请求评论列表、单话详情和“我的评论”均不再得到该评论，评论数同步减少。
4. 已删除评论视图能展示审计信息；重复删除返回 `409`。
5. 读者会话访问管理接口返回 `401`。
6. 使用本地数据启动 backend 与 admin-web，以真实登录、HTTP 请求和页面操作完成上述闭环。

## 文档同步

- 更新 `.agents/skills/api-contract/admin-web-api.md`。
- 更新 `docs/TECH.md` 的评论审计字段与索引说明。
