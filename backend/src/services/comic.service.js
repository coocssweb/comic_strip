// 漫画业务服务 — 承载创建、查询、更新的全部业务规则
// 禁止访问 ctx / req / res，保证可脱离 HTTP 环境单测

import { AppError } from '../middlewares/error-handler.middleware.js';
import { COMIC_STATUS } from '../models/comic.model.js';
import * as comicRepo from '../repositories/comic.repository.js';

/**
 * 创建漫画草稿（管理员专用）
 * @param {{ title: string, seriesId?: string|null, tags?: string[] }} params
 * @returns {Promise<object>} 完整漫画对象
 */
export async function createComic(params) {
  const comic = await comicRepo.create({
    title: params.title,
    seriesId: params.seriesId ?? null,
    tags: params.tags ?? [],
  });
  return comic;
}

/**
 * 查询漫画列表
 * 公开请求仅返回 status=published；管理员可通过 status 参数筛选全部状态
 *
 * @param {{
 *   status?: string,
 *   seriesId?: string,
 *   tag?: string,
 *   page: number,
 *   pageSize: number,
 *   isAdmin: boolean,
 * }} params
 * @returns {Promise<{ items: object[], total: number, page: number, pageSize: number }>}
 */
export async function listComics(params) {
  const { status, seriesId, tag, page, pageSize, isAdmin } = params;

  // 非管理员只能看到已发布的漫画
  const effectiveStatus = isAdmin ? status : COMIC_STATUS.PUBLISHED;

  return comicRepo.list({
    status: effectiveStatus,
    seriesId,
    tag,
    page,
    pageSize,
  });
}

/**
 * 查询单本漫画
 * 公开请求对非 published 漫画返回 404；管理员可查看任意状态
 *
 * @param {string} id - 漫画 ID
 * @param {boolean} isAdmin - 是否为管理员请求
 * @returns {Promise<object>} 漫画对象
 * @throws {AppError} 漫画不存在或无权限查看时抛出 404
 */
export async function getComic(id, isAdmin) {
  const comic = await comicRepo.findById(id);

  if (!comic) {
    throw new AppError('漫画不存在', 404, 'COMIC_NOT_FOUND');
  }

  // 非管理员只能查看已发布的漫画
  if (!isAdmin && comic.status !== COMIC_STATUS.PUBLISHED) {
    throw new AppError('漫画不存在', 404, 'COMIC_NOT_FOUND');
  }

  return comic;
}

/**
 * 更新漫画元信息（管理员专用）
 * 仅允许修改 title、seriesId、tags
 *
 * @param {string} id - 漫画 ID
 * @param {{ title?: string, seriesId?: string|null, tags?: string[] }} updates
 * @returns {Promise<object>} 更新后的漫画对象
 * @throws {AppError} 漫画不存在时抛出 404
 */
export async function updateComic(id, updates) {
  const comic = await comicRepo.findById(id);

  if (!comic) {
    throw new AppError('漫画不存在', 404, 'COMIC_NOT_FOUND');
  }

  return comicRepo.update(id, updates);
}
/**
 * 发布漫画：draft 或 unpublished 状态可发布，但必须有封面。
 *
 * @param {string} id - 漫画 ID
 * @returns {Promise<object>} 发布后的漫画对象
 * @throws {AppError} 漫画不存在（404）、状态冲突（409）、无封面（409）
 */
export async function publishComic(id) {
  const comic = await comicRepo.findById(id);

  if (!comic) {
    throw new AppError('漫画不存在', 404, 'COMIC_NOT_FOUND');
  }

  // 只有 draft 或 unpublished 才能发布
  if (comic.status !== COMIC_STATUS.DRAFT && comic.status !== COMIC_STATUS.UNPUBLISHED) {
    throw new AppError('当前状态不允许发布', 409, 'COMIC_STATUS_CONFLICT');
  }

  // 发布前必须有封面
  if (!comic.cover) {
    throw new AppError('发布前必须上传封面', 409, 'COMIC_NO_COVER');
  }

  return comicRepo.updateStatus(id, COMIC_STATUS.PUBLISHED, { publishedAt: new Date() });
}

/**
 * 下架漫画：仅 published 状态可下架。
 *
 * @param {string} id - 漫画 ID
 * @returns {Promise<object>} 下架后的漫画对象
 * @throws {AppError} 漫画不存在（404）、状态冲突（409）
 */
export async function unpublishComic(id) {
  const comic = await comicRepo.findById(id);

  if (!comic) {
    throw new AppError('漫画不存在', 404, 'COMIC_NOT_FOUND');
  }

  if (comic.status !== COMIC_STATUS.PUBLISHED) {
    throw new AppError('只有已发布的漫画才能下架', 409, 'COMIC_STATUS_CONFLICT');
  }

  return comicRepo.updateStatus(id, COMIC_STATUS.UNPUBLISHED);
}

/**
 * 软删除漫画：draft 或 unpublished 状态可删除，published 不可删除。
 *
 * @param {string} id - 漫画 ID
 * @returns {Promise<object|null>} 删除后的漫画对象
 * @throws {AppError} 漫画不存在（404）、状态冲突（409）
 */
export async function deleteComic(id) {
  const comic = await comicRepo.findById(id);

  if (!comic) {
    throw new AppError('漫画不存在', 404, 'COMIC_NOT_FOUND');
  }

  if (comic.status !== COMIC_STATUS.DRAFT && comic.status !== COMIC_STATUS.UNPUBLISHED) {
    throw new AppError('已发布的漫画不能直接删除，请先下架', 409, 'COMIC_STATUS_CONFLICT');
  }

  return comicRepo.updateStatus(id, COMIC_STATUS.DELETED);
}

/**
 * 恢复已删除漫画：仅 deleted 状态可恢复，恢复后为 draft。
 *
 * @param {string} id - 漫画 ID
 * @returns {Promise<object>} 恢复后的漫画对象
 * @throws {AppError} 漫画不存在（404）、状态冲突（409）
 */
export async function restoreComic(id) {
  const comic = await comicRepo.findById(id);

  if (!comic) {
    throw new AppError('漫画不存在', 404, 'COMIC_NOT_FOUND');
  }

  if (comic.status !== COMIC_STATUS.DELETED) {
    throw new AppError('只有已删除的漫画才能恢复', 409, 'COMIC_STATUS_CONFLICT');
  }

  return comicRepo.updateStatus(id, COMIC_STATUS.DRAFT, { publishedAt: null });
}
