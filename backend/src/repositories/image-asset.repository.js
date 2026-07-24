// 图片资产仓库层 — 封装全部 image_assets 集合的原子操作，Service 通过此层访问数据

import ImageAsset from '../models/image-asset.model.js';

/**
 * 按 key 查找单条图片资产记录
 * @param {string} key - COS 对象 key
 * @returns {Promise<object|null>}
 */
export async function findByKey(key) {
  return ImageAsset.findOne({ key }).lean();
}

/**
 * 批量按 key 查找图片资产
 * @param {string[]} keys - COS 对象 key 数组
 * @returns {Promise<object[]>}
 */
export async function findByKeys(keys) {
  return ImageAsset.find({ key: { $in: keys } }).lean();
}

/**
 * UPSERT 单条图片资产记录。
 * key 已存在时更新元数据，不存在时创建。
 *
 * @param {{ key: string, size: number, width?: number, height?: number, etag: string }} asset
 * @returns {Promise<object>}
 */
export async function upsert(asset) {
  return ImageAsset.findOneAndUpdate(
    { key: asset.key },
    {
      $set: {
        key: asset.key,
        size: asset.size,
        width: asset.width ?? 0,
        height: asset.height ?? 0,
        etag: asset.etag,
        uploadedAt: new Date(),
      },
    },
    { upsert: true, new: true, lean: true },
  );
}

/**
 * 批量 UPSERT 图片资产。
 * 在一个事务内对多个 key 执行 upsert。
 *
 * @param {Array<{ key: string, size: number, width?: number, height?: number, etag: string }>} assets
 * @returns {Promise<object[]>}
 */
export async function upsertMany(assets) {
  if (assets.length === 0) return [];

  const session = await ImageAsset.startSession();
  try {
    session.startTransaction();

    const results = [];
    for (const asset of assets) {
      const result = await ImageAsset.findOneAndUpdate(
        { key: asset.key },
        {
          $set: {
            key: asset.key,
            size: asset.size,
            width: asset.width ?? 0,
            height: asset.height ?? 0,
            etag: asset.etag,
            uploadedAt: new Date(),
          },
        },
        { upsert: true, new: true, lean: true, session },
      );
      results.push(result);
    }

    await session.commitTransaction();
    return results;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}
