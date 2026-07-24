// 连载业务服务 — 承载创建、查询、更新、生命周期管理的全部业务规则
// 禁止访问 ctx / req / res，保证可脱离 HTTP 环境单测

import mongoose from 'mongoose';
import { AppError } from '../middlewares/error-handler.middleware.js';
import { SERIES_STATUS } from '../models/series.model.js';
import * as seriesRepo from '../repositories/series.repository.js';
import Comic from '../models/comic.model.js';

/**
 * 校验成员漫画列表的有效性：
 * 1. 不允许同一漫画重复出现
 * 2. 所有漫画必须存在
 * 3. 不允许漫画已归属其他连载
 *
 * @param {Array<{comicId: string, order: number}>} comics - 成员漫画列表
 * @param {string} [excludeSeriesId] - 编辑场景排除自身连载 ID
 * @throws {AppError} 校验失败时抛出 409/400
 */
async function validateSeriesComics(comics, excludeSeriesId) {
  if (!comics || comics.length === 0) return;

  const comicIds = comics.map((c) => c.comicId);

  // 校验：不允许同一漫画重复出现
  const uniqueIds = new Set(comicIds);
  if (uniqueIds.size !== comicIds.length) {
    throw new AppError('连载成员漫画不允许重复', 409, 'SERIES_DUPLICATE_COMIC');
  }

  // 校验：所有漫画必须存在
  const existingComics = await Comic.find({ _id: { $in: comicIds } }).lean();
  const existingIds = new Set(existingComics.map((c) => c._id));
  const missingIds = comicIds.filter((id) => !existingIds.has(id));
  if (missingIds.length > 0) {
    throw new AppError('连载成员漫画不存在', 400, 'SERIES_COMIC_NOT_FOUND');
  }

  // 校验：不允许漫画已归属其他连载
  const comicInOtherSeries = await seriesRepo.findComicsInOtherSeries(comicIds, excludeSeriesId);
  if (comicInOtherSeries.size > 0) {
    const firstComicId = [...comicInOtherSeries.keys()][0];
    throw new AppError(
      `漫画 ${firstComicId} 已归属于其他连载`,
      409,
      'COMIC_ALREADY_IN_SERIES',
    );
  }
}

/**
 * 创建连载草稿（管理员专用）
 * @param {{ title: string, isCompleted?: boolean, comics?: Array<{comicId: string, order: number}> }} params
 * @returns {Promise<object>} 完整连载对象
 */
export async function createSeries(params) {
  // 校验成员漫画有效性
  await validateSeriesComics(params.comics);

  const series = await seriesRepo.create(params);
  return series;
}

/**
 * 查询连载列表
 * 公开请求仅返回 status=published；管理员可通过 status 参数筛选全部状态
 *
 * @param {{ status?: string, page: number, pageSize: number, sort?: string, isAdmin: boolean }} params
 * @returns {Promise<{ items: object[], total: number, page: number, pageSize: number }>}
 */
export async function listSeries(params) {
  const { status, page, pageSize, sort, isAdmin } = params;

  // 非管理员只能看到已发布的连载
  const effectiveStatus = isAdmin ? status : SERIES_STATUS.PUBLISHED;

  return seriesRepo.list({ status: effectiveStatus, page, pageSize, sort });
}

/**
 * 查询单本连载（展开成员漫画列表）
 * 公开请求对非 published 连载返回 404；管理员可查看任意状态
 *
 * @param {string} id - 连载 ID
 * @param {boolean} isAdmin - 是否为管理员请求
 * @returns {Promise<object>} 连载对象（comics 包含完整漫画信息）
 * @throws {AppError} 连载不存在或无权限查看时抛出 404
 */
export async function getSeries(id, isAdmin) {
  const series = await seriesRepo.findByIdWithComics(id);

  if (!series) {
    throw new AppError('连载不存在', 404, 'SERIES_NOT_FOUND');
  }

  // 非管理员只能查看已发布的连载
  if (!isAdmin && series.status !== SERIES_STATUS.PUBLISHED) {
    throw new AppError('连载不存在', 404, 'SERIES_NOT_FOUND');
  }

  return series;
}

/**
 * 更新连载元信息（管理员专用）
 * 允许修改 title、isCompleted、comics（全量替换，含排序）
 *
 * @param {string} id - 连载 ID
 * @param {{ title?: string, isCompleted?: boolean, comics?: Array<{comicId: string, order: number}> }} updates
 * @returns {Promise<object>} 更新后的连载对象
 * @throws {AppError} 连载不存在时抛出 404
 */
export async function updateSeries(id, updates) {
  const series = await seriesRepo.findById(id);

  if (!series) {
    throw new AppError('连载不存在', 404, 'SERIES_NOT_FOUND');
  }

  // 如果传入了 comics，进行成员漫画校验（排除当前连载自身）
  if (updates.comics !== undefined) {
    await validateSeriesComics(updates.comics, id);
  }

  return seriesRepo.update(id, updates);
}

/**
 * 发布连载：draft 或 unpublished 状态可发布
 *
 * @param {string} id - 连载 ID
 * @returns {Promise<object>} 发布后的连载对象
 * @throws {AppError} 连载不存在（404）、状态冲突（409）
 */
export async function publishSeries(id) {
  const series = await seriesRepo.findById(id);

  if (!series) {
    throw new AppError('连载不存在', 404, 'SERIES_NOT_FOUND');
  }

  // 只有 draft 或 unpublished 才能发布
  if (series.status !== SERIES_STATUS.DRAFT && series.status !== SERIES_STATUS.UNPUBLISHED) {
    throw new AppError('当前状态不允许发布', 409, 'SERIES_STATUS_CONFLICT');
  }

  return seriesRepo.updateStatus(id, SERIES_STATUS.PUBLISHED, { publishedAt: new Date() });
}

/**
 * 下架连载：仅 published 状态可下架
 *
 * @param {string} id - 连载 ID
 * @returns {Promise<object>} 下架后的连载对象
 * @throws {AppError} 连载不存在（404）、状态冲突（409）
 */
export async function unpublishSeries(id) {
  const series = await seriesRepo.findById(id);

  if (!series) {
    throw new AppError('连载不存在', 404, 'SERIES_NOT_FOUND');
  }

  if (series.status !== SERIES_STATUS.PUBLISHED) {
    throw new AppError('只有已发布的连载才能下架', 409, 'SERIES_STATUS_CONFLICT');
  }

  return seriesRepo.updateStatus(id, SERIES_STATUS.UNPUBLISHED);
}

/**
 * 软删除连载：draft 或 unpublished 状态可删除，published 不可删除。
 * 删除后不解绑成员漫画的 seriesId，成员漫画变为单篇。
 *
 * @param {string} id - 连载 ID
 * @returns {Promise<object|null>} 删除后的连载对象
 * @throws {AppError} 连载不存在（404）、状态冲突（409）
 */
export async function deleteSeries(id) {
  const series = await seriesRepo.findById(id);

  if (!series) {
    throw new AppError('连载不存在', 404, 'SERIES_NOT_FOUND');
  }

  if (series.status !== SERIES_STATUS.DRAFT && series.status !== SERIES_STATUS.UNPUBLISHED) {
    throw new AppError('已发布的连载不能直接删除，请先下架', 409, 'SERIES_STATUS_CONFLICT');
  }

  // 软删除连载本身，不解绑成员漫画的 seriesId（成员漫画变为单篇）
  return seriesRepo.updateStatus(id, SERIES_STATUS.DELETED);
}

/**
 * 恢复已删除连载：仅 deleted 状态可恢复，恢复后为 draft
 *
 * @param {string} id - 连载 ID
 * @returns {Promise<object>} 恢复后的连载对象
 * @throws {AppError} 连载不存在（404）、状态冲突（409）
 */
export async function restoreSeries(id) {
  const series = await seriesRepo.findById(id);

  if (!series) {
    throw new AppError('连载不存在', 404, 'SERIES_NOT_FOUND');
  }

  if (series.status !== SERIES_STATUS.DELETED) {
    throw new AppError('只有已删除的连载才能恢复', 409, 'SERIES_STATUS_CONFLICT');
  }

  return seriesRepo.updateStatus(id, SERIES_STATUS.DRAFT, { publishedAt: null });
}
