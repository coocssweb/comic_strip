// 图片控制器 — 请求参数提取 → 校验 → 调用 Service → 组装响应
// 禁止在此层出现业务判断逻辑

import { bindImagesSchema } from '../validators/image.validator.js';
import * as imageService from '../services/image.service.js';

/**
 * POST /api/v1/comics/:id/images/sts — 申请 STS 临时上传凭证
 */
export async function requestSts(ctx) {
  const { id } = ctx.params;

  const result = await imageService.requestStsForComic(id, ctx.config.cos);

  ctx.body = result;
}

/**
 * PUT /api/v1/comics/:id/images — 确认绑定封面和正文图片
 */
export async function bindImages(ctx) {
  const { id } = ctx.params;

  const parsed = bindImagesSchema.safeParse(ctx.request.body);
  if (!parsed.success) {
    ctx.status = 400;
    ctx.body = {
      code: 'VALIDATION_ERROR',
      message: parsed.error.issues.map((i) => i.message).join('；'),
      requestId: ctx.state?.requestId,
    };
    return;
  }

  const comic = await imageService.bindImages(id, parsed.data, ctx.config.cos);

  ctx.body = comic;
}
