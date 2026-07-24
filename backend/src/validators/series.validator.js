// 连载参数校验 — 基于 zod，统一管理 create / update / list 的校验规则

import { z } from 'zod';
import { SERIES_STATUS_VALUES } from '../models/series.model.js';

/** 成员漫画条目校验 */
const seriesComicEntrySchema = z.object({
  comicId: z.string({ required_error: '漫画ID不能为空' }).min(1, '漫画ID不能为空'),
  order: z.number({ required_error: '排序号不能为空' }).int('排序号必须为整数').min(0, '排序号不能为负数'),
});

/** 创建连载请求体校验 */
export const createSeriesSchema = z.object({
  title: z
    .string({ required_error: '标题不能为空' })
    .min(1, '标题不能为空')
    .max(100, '标题不能超过100个字符'),
  isCompleted: z
    .boolean()
    .optional()
    .default(false),
  comics: z
    .array(seriesComicEntrySchema)
    .optional()
    .default([]),
});

/** 更新连载请求体校验 */
export const updateSeriesSchema = z.object({
  title: z
    .string()
    .min(1, '标题不能为空')
    .max(100, '标题不能超过100个字符')
    .optional(),
  isCompleted: z
    .boolean()
    .optional(),
  comics: z
    .array(seriesComicEntrySchema)
    .optional(),
});

/** 连载列表查询参数校验 */
export const listSeriesQuerySchema = z.object({
  status: z
    .enum(SERIES_STATUS_VALUES, { errorMap: () => ({ message: '无效的连载状态' }) })
    .optional(),
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
  sort: z
    .string()
    .optional()
    .default('-createdAt')
    .refine((v) => /^-?(createdAt|updatedAt|publishedAt|title)$/.test(v), {
      message: '无效的排序字段',
    }),
});
