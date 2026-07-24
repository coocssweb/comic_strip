// 连载仓库层 — 封装全部 series 集合的原子操作，Service 通过此层访问数据

import Series from '../models/series.model.js';
import Comic from '../models/comic.model.js';

/**
 * 创建连载记录
 * @param {{ title: string, isCompleted?: boolean, comics?: Array<{comicId: string, order: number}> }} params
 * @returns {Promise<object>}
 */
export async function create(params) {
  const series = new Series({
    title: params.title,
    isCompleted: params.isCompleted ?? false,
    comics: params.comics ?? [],
  });
  await series.save();
  return series.toObject();
}

/**
 * 分页查询连载列表
 * @param {{ status?: string, page: number, pageSize: number, sort: string }} filters
 * @returns {Promise<{ items: object[], total: number, page: number, pageSize: number }>}
 */
export async function list(filters) {
  const { status, page, pageSize, sort = '-createdAt' } = filters;
  const query = {};

  if (status) query.status = status;

  const skip = (page - 1) * pageSize;

  const [items, total] = await Promise.all([
    Series.find(query)
      .sort(sort)
      .skip(skip)
      .limit(pageSize)
      .lean(),
    Series.countDocuments(query),
  ]);

  return { items, total, page, pageSize };
}

/**
 * 根据 ID 查找连载
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export async function findById(id) {
  return Series.findById(id).lean();
}

/**
 * 根据 ID 查找连载并展开成员漫画详情
 * 通过 comics[].comicId 批量查询关联漫画，再手动合并回连载对象
 * @param {string} id
 * @returns {Promise<object|null>} 连载对象，comics 数组中的每个元素包含完整漫画信息
 */
export async function findByIdWithComics(id) {
  const series = await Series.findById(id).lean();
  if (!series) return null;

  if (series.comics.length === 0) return series;

  // 批量查询所有成员漫画
  const comicIds = series.comics.map((c) => c.comicId);
  const comics = await Comic.find({ _id: { $in: comicIds } }).lean();

  // 构建 comicId -> comic 的映射
  const comicMap = new Map(comics.map((c) => [c._id, c]));

  // 按 order 排序后合并完整漫画信息
  series.comics = series.comics
    .sort((a, b) => a.order - b.order)
    .map((entry) => ({
      ...entry,
      comic: comicMap.get(entry.comicId) ?? null,
    }));

  return series;
}

/**
 * 更新连载元信息（title、isCompleted、comics）
 * @param {string} id
 * @param {{ title?: string, isCompleted?: boolean, comics?: Array<{comicId: string, order: number}> }} updates
 * @returns {Promise<object|null>}
 */
export async function update(id, updates) {
  const setFields = {};
  if (updates.title !== undefined) setFields.title = updates.title;
  if (updates.isCompleted !== undefined) setFields.isCompleted = updates.isCompleted;
  if (updates.comics !== undefined) setFields.comics = updates.comics;

  return Series.findByIdAndUpdate(id, { $set: setFields }, { returnDocument: 'after', lean: true });
}

/**
 * 更新连载状态（生命周期操作专用）
 * @param {string} id
 * @param {string} status
 * @param {object} [extraFields]
 * @returns {Promise<object|null>}
 */
export async function updateStatus(id, status, extraFields = {}) {
  const setFields = { status, ...extraFields };
  return Series.findByIdAndUpdate(id, { $set: setFields }, { returnDocument: 'after', lean: true });
}

/**
 * 查询已归属连载的漫画（仅查找非当前连载的关联）
 * 用于校验：新增成员漫画是否已属于其他连载。
 * 由于 Mongoose 的 多键索引查询特性，这里使用 $in 查询，
 * 并且需要排除当前连载自己。
 *
 * @param {string[]} comicIds - 要检查的漫画 ID 列表
 * @param {string} [excludeSeriesId] - 要排除的连载 ID（编辑场景排除自己）
 * @returns {Promise<Map<string, string>>} comicId -> seriesId 的映射
 */
export async function findComicsInOtherSeries(comicIds, excludeSeriesId) {
  const query = { 'comics.comicId': { $in: comicIds } };
  // 编辑场景需要排除当前连载自身
  if (excludeSeriesId) {
    query._id = { $ne: excludeSeriesId };
  }

  const seriesList = await Series.find(query).lean();

  const map = new Map();
  for (const series of seriesList) {
    for (const entry of series.comics) {
      if (comicIds.includes(entry.comicId)) {
        map.set(entry.comicId, series._id);
      }
    }
  }
  return map;
}

/**
 * 查询所有连载 ID（用于批量检查和清理）
 * @param {Array<{comicId: string}>} [comicIds] - 筛选条件（可选）
 * @returns {Promise<string[]>}
 */
export async function findSeriesIdsByComicIds(comicIds) {
  const query = {};
  if (comicIds && comicIds.length > 0) {
    query['comics.comicId'] = { $in: comicIds };
  }
  const series = await Series.find(query, { _id: 1 }).lean();
  return series.map((s) => s._id);
}

/**
 * 批量删除连载中的漫画成员
 * 从 comics 数组中移除指定 comicId 的条目
 * @param {string} seriesId - 连载 ID
 * @param {string[]} comicIds - 要移除的漫画 ID
 * @returns {Promise<object|null>}
 */
export async function removeComicsFromSeries(seriesId, comicIds) {
  return Series.findByIdAndUpdate(
    seriesId,
    { $pull: { comics: { comicId: { $in: comicIds } } } },
    { returnDocument: 'after', lean: true },
  );
}
