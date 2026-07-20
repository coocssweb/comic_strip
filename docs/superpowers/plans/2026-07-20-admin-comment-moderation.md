# 管理后台评论处置实施计划

> **给 AI 执行者：** 必须使用 `subagent-driven-development` 逐任务实施；每项任务完成后先做规范审查，再做代码质量审查。项目规则禁止执行 `git commit`。

**目标：** 管理员可分页查看有效与已删除评论，查阅删除审计信息，并软删除任意评论，使读者端后续请求不再返回该评论。

**架构：** 后端在既有 `/api/v1/admin` 内容路由中新增评论列表和删除端点，复用 `Comment` 现有软删除字段。后台在现有内容运营控制台新增“评论处置”资源，并以独立 API 封装获取分页数据和执行删除。后端完成并验证后再实现后台；最后使用本地服务完成真实 HTTP 联调和跨端审查。

**技术栈：** Koa、Mongoose、Joi、Node 内建测试、React、Jest、Testing Library、Tailwind。

---

### 任务 1：后端管理员评论接口、审计索引与契约

**文件：**

- 创建：`backend/src/controllers/admin-comment.controller.js`
- 修改：`backend/src/routes/content.route.js`
- 修改：`backend/src/models/comment.model.js`
- 创建：`backend/tests/admin-comment.controller.test.js`
- 修改：`.agents/skills/api-contract/admin-web-api.md`
- 修改：`docs/TECH.md`

- [ ] **步骤 1：先写失败的纯逻辑测试。**

在 `backend/tests/admin-comment.controller.test.js` 测试评论视图模型的以下行为：

```js
assert.deepEqual(
  toAdminComment({
    _id: 'comment-1',
    content: '测试评论',
    createdAt: new Date('2026-07-20T00:00:00.000Z'),
    readerId: { _id: 'reader-1', displayName: '读者', avatarUrl: null },
    episodeId: { _id: 'episode-1', title: '第一话', status: 'published' },
    deletedAt: null,
    deletedByRole: null,
    deletedById: null,
  }),
  {
    id: 'comment-1',
    content: '测试评论',
    createdAt: '2026-07-20T00:00:00.000Z',
    author: { id: 'reader-1', displayName: '读者', avatarUrl: null },
    episode: { id: 'episode-1', title: '第一话', status: 'published' },
    audit: null,
  },
);
```

同时覆盖已删除评论应映射 `audit.deletedAt` 与 `audit.deletedBy`。

- [ ] **步骤 2：运行失败测试。**

运行：`npm test -- admin-comment.controller.test.js`（工作目录 `backend`）。

预期：因 `toAdminComment` 尚不存在而失败。

- [ ] **步骤 3：实现最小后端功能。**

在 `admin-comment.controller.js`：

```js
export function toAdminComment(comment) {
  return {
    id: String(comment._id),
    content: comment.content,
    createdAt: comment.createdAt.toISOString(),
    author: {
      id: String(comment.readerId._id || comment.readerId),
      displayName: comment.readerId.displayName,
      avatarUrl: comment.readerId.avatarUrl || null,
    },
    episode: {
      id: String(comment.episodeId._id || comment.episodeId),
      title: comment.episodeId.title,
      status: comment.episodeId.status,
    },
    audit: comment.deletedAt
      ? {
          deletedAt: comment.deletedAt.toISOString(),
          deletedBy: { role: comment.deletedByRole, id: comment.deletedById },
        }
      : null,
  };
}
```

实现 `listAdminComments(ctx)`：按 `view` 选择 `deletedAt: null` 或 `deletedAt: { $ne: null }`，复用时间游标分页、关联读者及单话、返回 `{ items, nextCursor }`。实现 `deleteAdminComment(ctx)`：仅查找评论本身，不受单话发布状态约束；不存在抛出 `RESOURCE_NOT_FOUND`，已删除抛出 `COMMENT_ALREADY_DELETED`，否则写入当前管理员的审计字段并返回 `{ deleted: true }`。

在 `content.route.js`：导入控制器，扩展分页查询 schema 为 `view: Joi.string().valid('active', 'deleted').default('active')`，并在管理员路由中注册：

```js
contentRouter.get('/comments', validateQuery(commentPaginationSchema), listAdminComments);
contentRouter.delete('/comments/:commentId', validate(paramsSchema('commentId')), deleteAdminComment);
```

在 `comment.model.js` 增加索引：

```js
commentSchema.index({ deletedAt: 1, createdAt: -1, _id: -1 });
```

同步文档：登记两个端点、字段、权限和错误码；在 `docs/TECH.md` 说明软删除审计字段与索引。不得改动读者端接口。

- [ ] **步骤 4：运行后端测试与静态检查。**

运行：`npm test -- admin-comment.controller.test.js`、`npm test`、`npm run lint`（工作目录 `backend`）。

预期：全部通过。

- [ ] **步骤 5：完成报告。**

报告改动文件、TDD 红绿结果、测试命令、契约更新和未解决风险；不得执行 `git commit`。

### 任务 2：后台评论处置界面与 API 封装

**前置：** 仅在任务 1 的后端完成报告与审查通过后执行。

**文件：**

- 修改：`admin-web/src/api/content.js`
- 修改：`admin-web/src/components/ContentConsole.jsx`
- 修改：`admin-web/tests/content-api.test.js`
- 修改：`admin-web/tests/app.test.jsx`

- [ ] **步骤 1：先写失败的 API 封装测试。**

在 `admin-web/tests/content-api.test.js` 追加：

```js
await contentApi.listComments({ view: 'deleted', cursor: 'cursor-1' });
expect(request.get).toHaveBeenCalledWith('/admin/comments', {
  params: { view: 'deleted', cursor: 'cursor-1' },
});

await contentApi.deleteComment('comment-1');
expect(request.delete).toHaveBeenCalledWith('/admin/comments/comment-1');
```

在 `admin-web/tests/app.test.jsx` 为 `contentApi` mock 添加 `listComments` 与 `deleteComment`，并测试点击“评论处置”会请求有效评论；切换已删除视图会带 `view: 'deleted'` 且展示审计字段。

- [ ] **步骤 2：运行失败测试。**

运行：`npx jest tests/content-api.test.js tests/app.test.jsx --runInBand`（工作目录 `admin-web`）。

预期：因评论 API 和导航尚不存在而失败。

- [ ] **步骤 3：实现最小后台功能。**

在 `content.js` 增加：

```js
listComments(params) { return request.get('/admin/comments', { params }); }
deleteComment(commentId) { return request.delete(`/admin/comments/${commentId}`); }
```

在 `ContentConsole.jsx`：

- 向 `NAVIGATION` 和 `EMPTY_ITEMS` 添加 `comments`；该资源不显示新建或编辑入口。
- `loadResources` 对 `comments` 调用 `contentApi.listComments({ view: commentView })`，保存当前页和游标。
- 使用两个语义化按钮切换有效/已删除视图；切换时清空当前评论和游标并重载。
- 在 `ResourceTable` 为评论渲染正文、读者、所属单话、创建时间；已删除视图展示删除时间、角色和主体标识。
- 仅有效评论显示删除按钮，复用 `Dialog.alert`，明确说明软删除及读者端后续请求不可见；成功后提示中文结果并重新加载当前视图。
- 所有 API 错误走既有 `getErrorMessage` 与 `Toast`，不在页面直接调用 axios。

- [ ] **步骤 4：运行前端测试、lint 与构建。**

运行：`npx jest tests/content-api.test.js tests/app.test.jsx --runInBand`、`npm test -- --runInBand`、`npm run lint`、`npm run build`（工作目录 `admin-web`）。

预期：全部通过。

- [ ] **步骤 5：完成报告。**

报告页面、API、状态管理、用户反馈、已运行命令和发现的后端问题；不得执行 `git commit`。

### 任务 3：本地真实联调与跨端审查

**前置：** 仅在任务 1、任务 2 及各自两阶段审查通过后执行。

**文件：**

- 修改：`tickets.md`

- [ ] **步骤 1：准备本地联调环境。**

按仓库现有启动方式启动本地 backend 与 admin-web；只使用本地、开发、测试或脱敏数据，不连接生产环境。

- [ ] **步骤 2：执行真实请求和界面闭环。**

使用真实管理员登录，验证 `GET /api/v1/admin/comments?view=active`、`DELETE /api/v1/admin/comments/:commentId` 和 `GET /api/v1/admin/comments?view=deleted`。同时以读者身份重新请求公开评论与“我的评论”，确认被删评论不存在且评论数下降。

- [ ] **步骤 3：记录联调结论。**

报告启动方式、数据来源、请求路径、关键参数、响应结构、权限拦截、后台页面结果和失败信息；若本地服务或数据无法启动，明确报告阻塞，不用 mock 或静态审查代替。

- [ ] **步骤 4：跨端审查与完成状态。**

审查契约、权限、软删除审计、文档同步、测试位置和未授权额外修改。仅在真实联调通过且无 P0/P1 问题后，将 `tickets.md` 中本功能的三项验收清单更新为 `[x]`；不得执行 `git commit`。
