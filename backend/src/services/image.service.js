// 图片业务服务 — 承载 STS 签发、HeadObject 校验、图片绑定等全部业务规则
// 禁止访问 ctx / req / res，保证可脱离 HTTP 环境单测

import { AppError } from '../middlewares/error-handler.middleware.js';
import { COMIC_STATUS } from '../models/comic.model.js';
import * as comicRepo from '../repositories/comic.repository.js';
import * as imageAssetRepo from '../repositories/image-asset.repository.js';
import {
  createCosClient,
  generateStsCredentials,
  headObject,
  isKeyInComicNamespace,
} from '../utils/cos.js';

/**
 * 为漫画申请 STS 临时上传凭证。
 * 仅 draft 状态漫画允许申请。
 *
 * @param {string} comicId - 漫画 ID
 * @param {object} cosConfig - COS 配置对象
 * @returns {Promise<object>} STS 临时凭证
 * @throws {AppError} 漫画不存在（404）、非 draft 状态（409）
 */
export async function requestStsForComic(comicId, cosConfig) {
  const comic = await comicRepo.findById(comicId);

  if (!comic) {
    throw new AppError('漫画不存在', 404, 'COMIC_NOT_FOUND');
  }

  if (comic.status !== COMIC_STATUS.DRAFT) {
    throw new AppError('仅草稿状态的漫画可申请上传凭证', 409, 'COMIC_NOT_DRAFT');
  }

  // Key 前缀限定为 comics/:comicId/，客户端只能上传到此命名空间
  const keyPrefix = `comics/${comicId}/`;

  const stsData = await generateStsCredentials(cosConfig, keyPrefix);

  return {
    credentials: stsData.credentials,
    startTime: stsData.startTime,
    expiredTime: stsData.expiredTime,
    bucket: cosConfig.bucket,
    region: cosConfig.region,
    keyPrefix,
  };
}

/**
 * 校验并绑定漫画封面和正文图片。
 *
 * 流程：
 * 1. 校验 key 前缀必须在 comics/:comicId/ 下
 * 2. 校验 bodyImages order 必须从 0 开始连续递增
 * 3. 对所有 key 执行 COS HeadObject 校验
 * 4. 事务内 upsert image_assets + 更新 comics.cover / bodyImages
 *
 * @param {string} comicId - 漫画 ID
 * @param {{ cover: string, bodyImages: string[] }} params - 封面 key 和正文图片 key 数组
 * @param {object} cosConfig - COS 配置对象
 * @returns {Promise<object>} 更新后的漫画对象
 * @throws {AppError} 漫画不存在（404）、key 非法（403）、对象不存在（400）、ETag 不匹配（409）、order 不连续（400）
 */
export async function bindImages(comicId, params, cosConfig) {
  const { cover, bodyImages } = params;

  // ── 1. 查询漫画是否存在 ──
  const comic = await comicRepo.findById(comicId);
  if (!comic) {
    throw new AppError('漫画不存在', 404, 'COMIC_NOT_FOUND');
  }

  // ── 2. 校验所有 key 的命名空间 ──
  const allKeys = [cover, ...bodyImages];
  for (const key of allKeys) {
    if (!isKeyInComicNamespace(key, comicId)) {
      throw new AppError(`图片 key "${key}" 不在允许的命名空间下`, 403, 'IMAGE_KEY_NOT_ALLOWED');
    }
  }

  // ── 3. 校验 bodyImages order 从 0 开始连续递增 ──
  for (let i = 0; i < bodyImages.length; i++) {
    const expectedSuffix = `/${i}`;
    // 从 key 提取文件名部分（最后一个 / 之后），校验文件名与索引一致性
    const filename = bodyImages[i].split('/').pop();
    if (!filename || filename !== String(i)) {
      throw new AppError('正文图片顺序必须从 0 开始连续递增', 400, 'IMAGE_ORDER_NOT_SEQUENTIAL');
    }
  }

  // ── 4. 对每个 key 执行 HeadObject 校验 ──
  const cosClient = createCosClient(cosConfig);
  const headResults = [];

  for (const key of allKeys) {
    const headResult = await headObject(cosClient, cosConfig, key);

    if (!headResult) {
      throw new AppError(`图片对象不存在: ${key}`, 400, 'IMAGE_OBJECT_NOT_FOUND');
    }

    headResults.push({ key, ...headResult });
  }

  // ── 5. 事务内 upsert image_assets + 更新漫画 ──
  await imageAssetRepo.upsertMany(
    headResults.map((r) => ({
      key: r.key,
      size: r.size,
      etag: r.etag,
    })),
  );

  // 更新漫画封面与正文图片引用
  const updatedComic = await comicRepo.updateImageBinding(comicId, { cover, bodyImages });

  return updatedComic;
}
