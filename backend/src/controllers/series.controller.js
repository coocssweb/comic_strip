// 连载控制器 — 请求参数提取 → 校验 → 调用 Service → 组装响应
// 禁止在此层出现业务判断逻辑

import { signComicImages } from "../utils/cdn.js";
import { createSeriesSchema, updateSeriesSchema, listSeriesQuerySchema } from "../validators/series.validator.js";
import * as seriesService from "../services/series.service.js";
import { verifyToken } from "../utils/jwt.js";

/**
 * 判断当前请求是否为管理员。
 * POST/PUT 路由经 admin-auth 中间件设置 ctx.state.admin；
 * GET 路由无中间件，手动从 admin_session cookie 解析。
 */
function isAdmin(ctx) {
  if (ctx.state?.admin?.sub) return true;

  const token = ctx.cookies.get("admin_session");
  if (!token) return false;

  try {
    const payload = verifyToken(token, ctx.config.adminJwtSecret);
    return !!payload.sub;
  } catch {
    return false;
  }
}

/**
 * POST /api/v1/series — 创建连载草稿（管理员）
 */
export async function create(ctx) {
  const parsed = createSeriesSchema.safeParse(ctx.request.body);
  if (!parsed.success) {
    ctx.status = 400;
    ctx.body = {
      code: "VALIDATION_ERROR",
      message: parsed.error.issues.map((i) => i.message).join("；"),
      requestId: ctx.state?.requestId,
    };
    return;
  }

  const series = await seriesService.createSeries(parsed.data);

  ctx.status = 201;
  ctx.body = series;
}

/**
 * GET /api/v1/series — 查询连载列表
 */
export async function list(ctx) {
  const parsed = listSeriesQuerySchema.safeParse(ctx.query);
  if (!parsed.success) {
    ctx.status = 400;
    ctx.body = {
      code: "VALIDATION_ERROR",
      message: parsed.error.issues.map((i) => i.message).join("；"),
      requestId: ctx.state?.requestId,
    };
    return;
  }

  const result = await seriesService.listSeries({
    ...parsed.data,
    isAdmin: isAdmin(ctx),
  });

  ctx.body = result;
}

/**
 * GET /api/v1/series/:id — 查询单本连载（展开成员漫画）
 */
export async function getById(ctx) {
  const { id } = ctx.params;

  const admin = isAdmin(ctx);
  const series = await seriesService.getSeries(id, admin);

  // 公开请求：将成员漫画的图片 key 替换为 CDN 鉴权 URL
  if (!admin && series.comics && series.comics.length > 0) {
    series.comics = await Promise.all(
      series.comics.map(async (entry) => {
        if (entry.comic) {
          entry.comic = await signComicImages(entry.comic, ctx.config.cos);
        }
        return entry;
      }),
    );
  }

  ctx.body = series;
}

/**
 * PUT /api/v1/series/:id — 更新连载元信息（管理员）
 */
export async function update(ctx) {
  const { id } = ctx.params;

  const parsed = updateSeriesSchema.safeParse(ctx.request.body);
  if (!parsed.success) {
    ctx.status = 400;
    ctx.body = {
      code: "VALIDATION_ERROR",
      message: parsed.error.issues.map((i) => i.message).join("；"),
      requestId: ctx.state?.requestId,
    };
    return;
  }

  // 至少有一个字段需要更新
  if (Object.keys(parsed.data).length === 0) {
    ctx.status = 400;
    ctx.body = {
      code: "VALIDATION_ERROR",
      message: "至少需要提供一个要更新的字段",
      requestId: ctx.state?.requestId,
    };
    return;
  }

  const series = await seriesService.updateSeries(id, parsed.data);

  ctx.body = series;
}

/**
 * POST /api/v1/series/:id/publish — 发布连载（管理员）
 */
export async function publish(ctx) {
  const { id } = ctx.params;
  const series = await seriesService.publishSeries(id);
  ctx.body = series;
}

/**
 * POST /api/v1/series/:id/unpublish — 下架连载（管理员）
 */
export async function unpublish(ctx) {
  const { id } = ctx.params;
  const series = await seriesService.unpublishSeries(id);
  ctx.body = series;
}

/**
 * DELETE /api/v1/series/:id — 软删除连载（管理员）
 */
export async function remove(ctx) {
  const { id } = ctx.params;
  await seriesService.deleteSeries(id);
  ctx.status = 204;
}

/**
 * POST /api/v1/series/:id/restore — 恢复已删除连载（管理员）
 */
export async function restore(ctx) {
  const { id } = ctx.params;
  const series = await seriesService.restoreSeries(id);
  ctx.body = series;
}