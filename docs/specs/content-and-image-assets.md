 # Spec：内容与图片资产

 漫画/连载 CRUD + 图片上传绑定

 关联 GitHub Issue：[#49](https://github.com/coocssweb/comic_strip/issues/49)

 ## Problem Statement

 管理员需要在小程序管理端创建、编辑、发布和管理四格漫画及其连载系列。目前管理端仅有认证基础设施，还没有内容生产相关的能力。漫画是产品的核心内容单元——没有漫画 CRUD，整个小程序就是空壳。图片上传需要一个安全、可控的两阶段流程，确保只有经过后端校验的图片才能绑定到漫画上。

 ## Solution

 在已有管理员认证基础设施之上，新增漫画、连载和图片资产的完整管理能力。管理端提供漫画和连载的列表、创建/编辑表单、状态管理操作。图片上传采用「申请 STS 临时凭证 → 客户端直传 COS → 后端 HeadObject 校验 → 确认绑定」的两阶段流程。小程序端通过公开只读接口获取已发布漫画和连载，图片通过 CDN 鉴权 URL 实时签发。

 ## User Stories

 **管理员 - 漫画管理**

 1. 作为管理员，我想要创建一篇新漫画（初始为草稿），以便在完成编辑前暂存内容。
 2. 作为管理员，我想要为草稿漫画上传封面图片和正文图片，以便漫画有视觉内容。
 3. 作为管理员，我想要调整正文图片的顺序，以便控制读者的阅读体验。
 4. 作为管理员，我想要编辑漫画的标题、封面、正文图片、标签和所属连载，以便维护内容准确性。
 5. 作为管理员，我想要将草稿或已下架的漫画发布，以便用户能在小程序中看到它。
 6. 作为管理员，我想要将已发布的漫画下架，以便临时隐藏内容而不删除。
 7. 作为管理员，我想要软删除草稿或已下架的漫画，以便清理不再需要的内容。
 8. 作为管理员，我想要恢复已删除的漫画，以便纠正误删操作。
 9. 作为管理员，我想要在漫画列表中按状态（全部/草稿/已发布/已下架/已删除）筛选漫画，以便快速定位需要操作的内容。
 10. 作为管理员，我想要查看漫画的完整详情（包括封面和所有正文图片），以便在操作前确认内容。

 **管理员 - 连载管理**

 11. 作为管理员，我想要创建一个新连载，以便将相关漫画组织成系列。
 12. 作为管理员，我想要向连载中添加漫画成员并调整显示顺序，以便控制用户的阅读顺序。
 13. 作为管理员，我想要将漫画从连载中移除，以便调整系列结构。
 14. 作为管理员，我想要将连载标记为「已完结」或取消完结，以便向用户传达更新状态。
 15. 作为管理员，我想要发布、下架、删除和恢复连载，以便管理连载的生命周期。

 **管理员 - 图片上传**

 16. 作为管理员，我想要为指定漫画申请 STS 临时上传凭证，以便安全地将图片直传到 COS。
 17. 作为管理员，我想要在图片上传完成后确认绑定到漫画，以便系统校验并建立权威绑定关系。
 18. 作为管理员，如果上传了错误图片，我想要替换封面或正文图片，以便修正内容。

 **小程序用户 - 公开浏览**

 19. 作为小程序用户，我想要浏览已发布漫画的列表，以便发现感兴趣的内容。
 20. 作为小程序用户，我想要查看单篇漫画的封面和所有正文图片，以便阅读完整内容。
 21. 作为小程序用户，我想要按连载浏览其下所有漫画，以便按顺序阅读系列内容。
 22. 作为小程序用户，我想要按标签筛选漫画列表，以便找到特定类型的漫画。

 **系统 - 安全与一致性**

 23. 作为系统，我要求只有草稿状态的漫画才能申请图片上传凭证，以防止已发布内容被意外修改。
 24. 作为系统，我要校验所有绑定图片的 COS 对象真实存在且 ETag 匹配，以防止引用无效或错误的图片。
 25. 作为系统，我要确保已下架和已删除的内容停止签发新的图片 CDN URL，以保护内容安全。
 26. 作为系统，我要确保每篇漫画最多只属于一个连载，以防止数据不一致。

 ## Implementation Decisions

 ### API 端点

 **漫画 `/api/v1/comics`**

 | 方法 | 路径 | 权限 | 说明 |
 |------|------|------|------|
 | GET | `/comics` | 公开 | 只返回已发布漫画，支持 `?seriesId`、`?tag`、分页 |
 | GET | `/comics/:id` | 公开(已发布)/管理(全部) | 未发布漫画对公开请求返回 404 |
 | POST | `/comics` | 管理员 | 创建草稿 |
 | PUT | `/comics/:id` | 管理员 | 编辑元信息（标题、连载归属、标签） |
 | POST | `/comics/:id/publish` | 管理员 | 发布（须有封面，状态为 draft/unpublished） |
 | POST | `/comics/:id/unpublish` | 管理员 | 下架（状态须为 published） |
 | DELETE | `/comics/:id` | 管理员 | 软删除（状态须为 draft/unpublished） |
 | POST | `/comics/:id/restore` | 管理员 | 恢复（状态须为 deleted，不自动发布） |

 **漫画图片（子资源）**

 | 方法 | 路径 | 权限 | 说明 |
 |------|------|------|------|
 | POST | `/comics/:id/images/sts` | 管理员 | 申请 STS 临时凭证，漫画须为 draft |
 | PUT | `/comics/:id/images` | 管理员 | 确认绑定封面+正文图片，后端 HeadObject 校验 |

 **连载 `/api/v1/series`**

 | 方法 | 路径 | 权限 | 说明 |
 |------|------|------|------|
 | GET | `/series` | 公开 | 只返回已发布连载 |
 | GET | `/series/:id` | 公开(已发布)/管理(全部) | 公开返回展开成员漫画列表 |
 | POST | `/series` | 管理员 | 创建 |
 | PUT | `/series/:id` | 管理员 | 编辑（标题、完结状态、成员全量替换） |
 | POST | `/series/:id/publish` | 管理员 | 发布 |
 | POST | `/series/:id/unpublish` | 管理员 | 下架 |
 | DELETE | `/series/:id` | 管理员 | 软删除 |
 | POST | `/series/:id/restore` | 管理员 | 恢复 |

 ### 数据模型

 **`comics` 集合**

 - `title`: String，必填 1-100 字符
 - `seriesId`: ObjectId|null，最多归属一个连载
 - `status`: "draft"|"published"|"unpublished"|"deleted"
 - `cover`: { assetId, key } — 独立封面嵌入引用
 - `bodyImages`: [{ assetId, key, order }] — 有序正文图片嵌入引用
 - `tags`: [ObjectId] — 去重标签引用
 - `likeCount`, `favoriteCount`, `commentCount`: Number，默认 0（互动切片维护）
 - `publishedAt`: Date|null
 - `createdAt`, `updatedAt`: Date

 索引：`{ status: 1, publishedAt: -1 }`、`{ seriesId: 1 }`、`{ tags: 1 }`

 **`series` 集合**

 - `title`: String，必填 1-100 字符
 - `status`: "draft"|"published"|"unpublished"|"deleted"
 - `isCompleted`: Boolean，默认 false
 - `comics`: [{ comicId, order }] — 有序漫画引用
 - `publishedAt`: Date|null
 - `createdAt`, `updatedAt`: Date

 索引：`{ status: 1, publishedAt: -1 }`

 **`image_assets` 集合**

 - `key`: String — COS object key，唯一
 - `size`: Number
 - `width`, `height`: Number
 - `etag`: String — COS ETag
 - `uploadedAt`: Date

 唯一索引：`{ key: 1 }`。不存储 URL（读取时动态签发 CDN 鉴权 URL），不存储绑定关系（以漫画端引用为权威）。

 ### 图片上传流程

 **阶段一**：`POST /comics/:id/images/sts` → 后端签发 STS 临时凭证，限制 Key 前缀为 `comics/:comicId/`。

 **阶段二**：`PUT /comics/:id/images` → 客户端提交封面和正文图片的 key 列表，后端对每个 key 执行 COS HeadObject 校验对象存在性及 ETag；全部通过后在事务内 upsert `image_assets` 并更新 `comics.cover` 和 `comics.bodyImages`。

 COS 回调（云函数 → Webhook）仅作为漏单补偿，不参与主流程。

 ### 校验规则

 - 发布漫画：必须有封面，状态须为 draft 或 unpublished
 - 软删除：状态须为 draft 或 unpublished（已发布内容必须先下架）
 - `bodyImages[].order`：必须从 0 开始连续递增
 - 图片 key 前缀：必须在 `comics/:comicId/` 下
 - 连载成员漫画：不允许同一漫画重复出现，不允许加入已归属其他连载的漫画
 - 标签：引用标签须存在且状态为「启用」
 - CDN URL：30 分钟有效期，下架/删除内容停止签发

 ### 业务错误码

 | 场景 | HTTP | code |
 |------|------|------|
 | 漫画/连载不存在或不可见 | 404 | `COMIC_NOT_FOUND` / `SERIES_NOT_FOUND` |
 | 封面未设置时尝试发布 | 409 | `COMIC_NO_COVER` |
 | 状态不允许当前操作 | 409 | `COMIC_STATUS_CONFLICT` / `SERIES_STATUS_CONFLICT` |
 | 漫画已归属其他连载 | 409 | `COMIC_ALREADY_IN_SERIES` |
 | 连载内重复漫画 | 409 | `SERIES_DUPLICATE_COMIC` |
 | 连载成员漫画不存在 | 400 | `SERIES_COMIC_NOT_FOUND` |
 | 图片 key 不在前缀下 | 403 | `IMAGE_KEY_NOT_ALLOWED` |
 | COS 对象不存在 | 400 | `IMAGE_OBJECT_NOT_FOUND` |
 | COS ETag 不匹配 | 409 | `IMAGE_ETAG_MISMATCH` |
 | 非草稿申请 STS | 409 | `COMIC_NOT_DRAFT` |
 | order 不连续 | 400 | `IMAGE_ORDER_NOT_SEQUENTIAL` |
 | 标签不可用 | 400 | `TAG_NOT_AVAILABLE` |

 ### 管理端页面

 - 漫画列表页：状态 tab 筛选 + 分页
 - 漫画编辑页：标题、连载选择、封面上传、正文图片上传（拖拽排序）、标签选择
 - 创建漫画：先 POST 空草稿 → 跳转编辑页
 - 连载列表页：状态 tab 筛选 + 分页
 - 连载编辑页：标题、完结状态开关、成员排序

 ## Testing Decisions

 ### 测试接缝（自高到低）

 **Service 层**（最高接缝）：纯业务逻辑，mock Model/Repository，不连 DB 和 COS。覆盖状态机流转、连载成员管理、图片 key 校验、order 连续性。

 **Repository 层**（集成接缝）：连真实 MongoDB，验证 schema 约束、索引行为、`image_assets` 的 upsert 去重、并发竞态、分页排序。

 **API 层**（契约接缝）：Koa 黑盒测试，不 mock Service。覆盖 HTTP 状态码、错误语义、鉴权隔离、响应体格式。

 **COS 替身**（外部接缝）：stub COS SDK。覆盖 STS 签发、HeadObject 成功/失败/ETag 不匹配、Webhook 回调。

 ### 测试原则

 - 只测试外部可观察行为，不测试实现细节
 - 每个测试独立，不依赖其他测试的执行顺序
 - 错误路径必须覆盖（合法流转 + 非法流转）
 - 集成测试使用独立测试数据库
 - 遵循 `backend/tests` 目录集中管理的项目约定

 ## Out of Scope

 - 标签管理 CRUD（属于「标签与推荐」切片）
 - 互动功能（点赞/收藏/评论，属于「用户与互动」切片）
 - 排行榜（属于「排行榜」切片）
 - 永久清理操作（属于「运维与日志」切片）
 - 未绑定图片的自动清理
 - 图片裁剪/压缩/格式转换
 - 批量导入/导出漫画
 - 漫画内容搜索
 - 小程序端 UI 实现

 ## Further Notes

 - 公开接口返回的图片 URL 均为带时效的 CDN 鉴权 URL，每次请求实时签发，有效期 30 分钟
 - 漫画删除不级联删除连载、标签或图片资产（永久清理时才删除 COS 对象）
 - 连载删除不解绑成员漫画，成员漫画变为单篇
 - 连载的「已完结」状态与内容生命周期独立，草稿连载也可以是已完结
 - 空连载（无成员漫画）允许存在并正常展示
 - 编辑已发布漫画的元信息（标题、标签、连载归属）不改变其已发布状态
