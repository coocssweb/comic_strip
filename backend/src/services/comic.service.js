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
