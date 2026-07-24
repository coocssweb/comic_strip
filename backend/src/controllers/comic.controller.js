// 漫画控制器 — 请求参数提取 → 校验 → 调用 Service → 组装响应
// 禁止在此层出现业务判断逻辑

import { createComicSchema, updateComicSchema, listComicsQuerySchema } from '../validators/comic.validator.js';
import * as comicService from '../services/comic.service.js';
import { verifyToken } from '../utils/jwt.js';

/**
 * 判断当前请求是否为管理员。
 * POST/PUT 路由经 admin-auth 中间件设置 ctx.state.admin；
 * GET 路由无中间件，手动从 admin_session cookie 解析。
 */
function isAdmin(ctx) {
  if (ctx.state?.admin?.sub) return true;

  const token = ctx.cookies.get('admin_session');
  if (!token) return false;

  try {
    const payload = verifyToken(token, ctx.config.adminJwtSecret);
    return !!payload.sub;
  } catch {
    return false;
  }
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
/**
 * POST /api/v1/comics/:id/publish — 发布漫画（管理员）
 */
export async function publish(ctx) {
  const { id } = ctx.params;
  const comic = await comicService.publishComic(id);
  ctx.body = comic;
}

/**
 * POST /api/v1/comics/:id/unpublish — 下架漫画（管理员）
 */
export async function unpublish(ctx) {
  const { id } = ctx.params;
  const comic = await comicService.unpublishComic(id);
  ctx.body = comic;
}

/**
 * DELETE /api/v1/comics/:id — 软删除漫画（管理员）
 */
export async function remove(ctx) {
  const { id } = ctx.params;
  await comicService.deleteComic(id);
  ctx.status = 204;
}

/**
 * POST /api/v1/comics/:id/restore — 恢复已删除漫画（管理员）
 */
export async function restore(ctx) {
  const { id } = ctx.params;
  const comic = await comicService.restoreComic(id);
  ctx.body = comic;
}
