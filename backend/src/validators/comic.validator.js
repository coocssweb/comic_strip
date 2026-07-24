// 漫画参数校验 — 基于 zod，统一管理 create / update / list 的校验规则

import { z } from 'zod';
import { COMIC_STATUS_VALUES } from '../models/comic.model.js';

/** 创建漫画请求体校验 */
export const createComicSchema = z.object({
  title: z
    .string({ required_error: '标题不能为空' })
    .min(1, '标题不能为空')
    .max(100, '标题不能超过100个字符'),
  seriesId: z
    .string()
    .optional()
    .nullable()
    .default(null),
  tags: z
    .array(z.string())
    .optional()
    .default([]),
});

/** 更新漫画请求体校验 */
export const updateComicSchema = z.object({
  title: z
    .string()
    .min(1, '标题不能为空')
    .max(100, '标题不能超过100个字符')
    .optional(),
  seriesId: z
    .string()
    .optional()
    .nullable(),
  tags: z
    .array(z.string())
    .optional(),
});

/** 漫画列表查询参数校验 */
export const listComicsQuerySchema = z.object({
  status: z
    .enum(COMIC_STATUS_VALUES, { errorMap: () => ({ message: '无效的漫画状态' }) })
    .optional(),
  seriesId: z.string().optional(),
  tag: z.string().optional(),
  page: z
    .string()
    .optional()
    .default('1')
    .transform((v) => {
      const n = parseInt(v, 10);
      if (isNaN(n) || n < 1) return 1;
      return n;
    }),
  pageSize: z
    .string()
    .optional()
    .default('20')
    .transform((v) => {
      const n = parseInt(v, 10);
      if (isNaN(n) || n < 1) return 20;
      if (n > 100) return 100;
      return n;
    }),
});
