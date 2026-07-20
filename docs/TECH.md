# 技术说明

## 评论软删除审计

`comments` 集合使用既有字段保留评论处置审计信息，不进行物理删除或 Schema 迁移：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `deletedAt` | `Date \| null` | 软删除时间；`null` 表示有效评论。 |
| `deletedByRole` | `reader \| admin \| null` | 执行删除的主体角色。 |
| `deletedById` | `String \| null` | 执行删除的主体标识。 |

管理后台按创建时间倒序分页有效或已删除评论，`comments` 集合使用两条部分索引支持稳定时间游标翻页：有效视图使用 `{ deletedAt: 1, createdAt: -1, _id: -1 }` 且 `partialFilterExpression: { deletedAt: null }`，等值的 `deletedAt: null` 条件后可直接按 `createdAt/_id` 倒序扫描；已删除视图使用 `{ createdAt: -1, _id: -1, deletedAt: 1 }` 且 `partialFilterExpression: { deletedAt: { $type: 'date' } }`，该部分索引仅保留已删除记录并以游标字段为排序前缀。两条索引键序不同，MongoDB 可以同时创建。已删除查询使用相同的 `deletedAt: { $type: 'date' }` 条件以命中对应索引。读者侧评论查询持续使用 `deletedAt: null`，因此管理员软删除会在后续读者请求中生效。

开发和测试环境以 `autoIndex: true` 连接数据库，并在启动时加载全部模型声明，使 Mongoose 自动创建缺失索引。生产环境以 `autoIndex: false` 启动，不自动变更任何索引；索引变更必须显式执行 `npm run ensure-indexes` 进入受控运维或迁移流程。该入口先为全部已注册模型补建索引，再删除旧版 `active_comments_by_created_at`；旧索引不存在时按 MongoDB `IndexNotFound` 处理以保持幂等。该删除步骤只在显式迁移入口执行，`npm start` 不会删除或修改生产索引。
