// 标签参数校验 — 基于 zod，统一管理 create / update / list 的校验规则
import { z } from 'zod';
import { TAG_STATUS_VALUES } from '../models/tag.model.js';

/** 创建标签请求体校验 */
export const createTagSchema = z.object({
  name: z
    .string({ required_error: '标签名称不能为空' })
    .min(1, '标签名称不能为空')
    .max(30, '标签名称不能超过30个字符'),
  sortOrder: z
    .number()
    .int('排序号必须为整数')
    .optional()
    .default(0),
});

/** 更新标签请求体校验 */
export const updateTagSchema = z.object({
  name: z
    .string()
    .min(1, '标签名称不能为空')
    .max(30, '标签名称不能超过30个字符')
    .optional(),
  sortOrder: z
    .number()
    .int('排序号必须为整数')
    .optional(),
  status: z
    .enum(TAG_STATUS_VALUES, { errorMap: () => ({ message: '无效的标签状态' }) })
    .optional(),
  isRecommended: z
    .boolean()
    .optional(),
  recommendedOrder: z
    .number()
    .int('推荐排序号必须为整数')
    .optional(),
});

/** 标签列表查询参数校验 */
export const listTagsQuerySchema = z.object({
  status: z
    .enum(TAG_STATUS_VALUES, { errorMap: () => ({ message: '无效的标签状态' }) })
    .optional(),
  isRecommended: z
    .string()
    .optional()
    .transform((v) => {
      if (v === 'true') return true;
      if (v === 'false') return false;
      return undefined;
    }),
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
    .refine((v) => /^-?(createdAt|updatedAt|name|sortOrder|recommendedOrder)$/.test(v), {
      message: '无效的排序字段',
    }),
});
