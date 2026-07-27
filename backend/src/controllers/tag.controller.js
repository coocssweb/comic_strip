// 标签控制器 — 请求参数提取 → 校验 → 调用 Service → 组装响应
// 禁止在此层出现业务判断逻辑

import { createTagSchema, updateTagSchema, listTagsQuerySchema } from '../validators/tag.validator.js';
import * as tagService from '../services/tag.service.js';

/**
 * POST /admin/tags — 创建标签（管理员）
 */
export async function create(ctx) {
  const parsed = createTagSchema.safeParse(ctx.request.body);
  if (!parsed.success) {
    ctx.status = 400;
    ctx.body = {
      code: 'VALIDATION_ERROR',
      message: parsed.error.issues.map((i) => i.message).join('；'),
      requestId: ctx.state?.requestId,
    };
    return;
  }

  const tag = await tagService.createTag(parsed.data);

  ctx.status = 201;
  ctx.body = { success: true, data: tag };
}

/**
 * GET /admin/tags — 查询标签列表（管理员）
 */
export async function list(ctx) {
  const parsed = listTagsQuerySchema.safeParse(ctx.query);
  if (!parsed.success) {
    ctx.status = 400;
    ctx.body = {
      code: 'VALIDATION_ERROR',
      message: parsed.error.issues.map((i) => i.message).join('；'),
      requestId: ctx.state?.requestId,
    };
    return;
  }

  const result = await tagService.listTags(parsed.data);

  ctx.body = { success: true, data: result };
}

/**
 * GET /admin/tags/:id — 查询单个标签（管理员）
 */
export async function getById(ctx) {
  const { id } = ctx.params;
  const tag = await tagService.getTag(id);
  ctx.body = { success: true, data: tag };
}

/**
 * PATCH /admin/tags/:id — 更新标签（管理员）
 */
export async function update(ctx) {
  const { id } = ctx.params;

  const parsed = updateTagSchema.safeParse(ctx.request.body);
  if (!parsed.success) {
    ctx.status = 400;
    ctx.body = {
      code: 'VALIDATION_ERROR',
      message: parsed.error.issues.map((i) => i.message).join('；'),
      requestId: ctx.state?.requestId,
    };
    return;
  }

  // 至少有一个字段需要更新
  if (Object.keys(parsed.data).length === 0) {
    ctx.status = 400;
    ctx.body = {
      code: 'VALIDATION_ERROR',
      message: '至少需要提供一个要更新的字段',
      requestId: ctx.state?.requestId,
    };
    return;
  }

  const tag = await tagService.updateTag(id, parsed.data);
  ctx.body = { success: true, data: tag };
}

/**
 * DELETE /admin/tags/:id — 软删除标签（管理员）
 */
export async function remove(ctx) {
  const { id } = ctx.params;
  await tagService.deleteTag(id);
  ctx.status = 204;
}

/**
 * POST /admin/tags/:id/restore — 恢复已删除标签（管理员）
 */
export async function restore(ctx) {
  const { id } = ctx.params;
  const tag = await tagService.restoreTag(id);
  ctx.body = { success: true, data: tag };
}

/**
 * DELETE /admin/tags/:id/permanent — 永久清理标签（管理员）
 */
export async function permanentDelete(ctx) {
  const { id } = ctx.params;
  await tagService.permanentDeleteTag(id);
  ctx.status = 204;
}
