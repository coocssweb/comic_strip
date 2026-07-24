// 漫画仓库层 — 封装全部 comics 集合的原子操作，Service 通过此层访问数据

import Comic from '../models/comic.model.js';

/**
 * 创建漫画记录
 * @param {{ title: string, seriesId?: string|null, tags?: string[] }} params
 * @returns {Promise<object>}
 */
export async function create(params) {
  const comic = new Comic({
    title: params.title,
    seriesId: params.seriesId ?? null,
    tags: params.tags ?? [],
  });
  await comic.save();
  return comic.toObject();
}

/**
 * 分页查询漫画列表
 * @param {{ status?: string, seriesId?: string, tag?: string, page: number, pageSize: number }} filters
 * @returns {Promise<{ items: object[], total: number, page: number, pageSize: number }>}
 */
export async function list(filters) {
  const { status, seriesId, tag, page, pageSize } = filters;
  const query = {};

  if (status) query.status = status;
  if (seriesId) query.seriesId = seriesId;
  if (tag) query.tags = tag;

  const skip = (page - 1) * pageSize;

  const [items, total] = await Promise.all([
    Comic.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean(),
    Comic.countDocuments(query),
  ]);

  return { items, total, page, pageSize };
}

/**
 * 根据 ID 查找漫画
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export async function findById(id) {
  return Comic.findById(id).lean();
}

/**
 * 更新漫画元信息（title、seriesId、tags）
 * @param {string} id
 * @param {{ title?: string, seriesId?: string|null, tags?: string[] }} updates
 * @returns {Promise<object|null>}
 */
export async function update(id, updates) {
  const setFields = {};
  if (updates.title !== undefined) setFields.title = updates.title;
  if (updates.seriesId !== undefined) setFields.seriesId = updates.seriesId ?? null;
  if (updates.tags !== undefined) setFields.tags = updates.tags;

  return Comic.findByIdAndUpdate(id, { $set: setFields }, { new: true, lean: true });
}
/**
 * 更新漫画状态（生命周期操作专用）。
 * 仅修改 status 及可选的额外字段（如 publishedAt）。
 * 不验证状态流转合法性——由 Service 层保证。
 *
 * @param {string} id - 漫画 ID
 * @param {string} status - 目标状态
 * @param {object} [extraFields] - 额外要更新的字段
 * @returns {Promise<object|null>}
 */
export async function updateStatus(id, status, extraFields = {}) {
  const setFields = { status, ...extraFields };
  return Comic.findByIdAndUpdate(id, { $set: setFields }, { new: true, lean: true });
}
