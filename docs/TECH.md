# 技术说明

## 评论软删除审计

`comments` 集合使用既有字段保留评论处置审计信息，不进行物理删除或 Schema 迁移：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `deletedAt` | `Date \| null` | 软删除时间；`null` 表示有效评论。 |
| `deletedByRole` | `reader \| admin \| null` | 执行删除的主体角色。 |
| `deletedById` | `String \| null` | 执行删除的主体标识。 |

管理后台按创建时间倒序分页有效或已删除评论，`comments` 集合使用两条部分索引支持稳定时间游标翻页：`{ createdAt: -1, _id: -1 }` 且 `partialFilterExpression: { deletedAt: null }` 用于有效评论；同键序且 `partialFilterExpression: { deletedAt: { $type: 'date' } }` 用于已删除评论。已删除查询使用相同的 `deletedAt: { $type: 'date' }` 条件以命中对应索引。读者侧评论查询持续使用 `deletedAt: null`，因此管理员软删除会在后续读者请求中生效。
