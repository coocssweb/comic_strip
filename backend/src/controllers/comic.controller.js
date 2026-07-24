// 漫画控制器 — 请求参数提取 → 校验 → 调用 Service → 组装响应
// 禁止在此层出现业务判断逻辑

import { createComicSchema, updateComicSchema, listComicsQuerySchema } from '../validators/comic.validator.js';
import * as comicService from '../services/comic.service.js';

/**
 * 判断当前请求是否为管理员
 * admin-auth 中间件校验通过后 ctx.state.admin 存在且含 sub（adminId）
 */
function isAdmin(ctx) {
  return !!(ctx.state?.admin?.sub);
}

/**
 * POST /api/v1/comics — 创建漫画草稿（管理员）
 */
export async function create(ctx) {
  const parsed = createComicSchema.safeParse(ctx.request.body);
  if (!parsed.success) {
    ctx.status = 400;
    ctx.body = {
      code: 'VALIDATION_ERROR',
      message: parsed.error.issues.map((i) => i.message).join('；'),
      requestId: ctx.state?.requestId,
    };
    return;
  }

  const comic = await comicService.createComic(parsed.data);

  ctx.status = 201;
  ctx.body = comic;
}

/**
 * GET /api/v1/comics — 查询漫画列表
 */
export async function list(ctx) {
  const parsed = listComicsQuerySchema.safeParse(ctx.query);
  if (!parsed.success) {
    ctx.status = 400;
    ctx.body = {
      code: 'VALIDATION_ERROR',
      message: parsed.error.issues.map((i) => i.message).join('；'),
      requestId: ctx.state?.requestId,
    };
    return;
  }

  const result = await comicService.listComics({
    ...parsed.data,
    isAdmin: isAdmin(ctx),
  });

  ctx.body = result;
}

/**
 * GET /api/v1/comics/:id — 查询单本漫画
 */
export async function getById(ctx) {
  const { id } = ctx.params;

  const comic = await comicService.getComic(id, isAdmin(ctx));

  ctx.body = comic;
}

/**
 * PUT /api/v1/comics/:id — 更新漫画元信息（管理员）
 */
export async function update(ctx) {
  const { id } = ctx.params;

  const parsed = updateComicSchema.safeParse(ctx.request.body);
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

  const comic = await comicService.updateComic(id, parsed.data);

  ctx.body = comic;
}
