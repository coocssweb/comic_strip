// 图片参数校验 — 基于 zod，统一管理 STS 申请与图片绑定的校验规则

import { z } from 'zod';

/** 图片绑定请求体校验 */
export const bindImagesSchema = z.object({
  cover: z
    .string({ required_error: '封面图片 key 不能为空' })
    .min(1, '封面图片 key 不能为空'),
  bodyImages: z
    .array(z.string())
    .default([]),
});
