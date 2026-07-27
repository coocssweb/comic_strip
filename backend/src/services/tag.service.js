// 标签业务服务 — 承载创建、查询、更新、状态管理的全部业务规则
// 禁止访问 ctx / req / res，保证可脱离 HTTP 环境单测

import { AppError } from '../middlewares/error-handler.middleware.js';
import { TAG_STATUS } from '../models/tag.model.js';
import Tag from '../models/tag.model.js';

/**
 * 创建标签 — 新标签默认为启用状态
 * @param {{ name: string, sortOrder?: number }} params
 * @returns {Promise<object>} 完整标签对象
 * @throws {AppError} 标签名已存在时抛出 409
 */
export async function createTag(params) {
  // 检查同名标签是否已存在（非已删除状态）
  const existing = await Tag.findOne({
    name: params.name,
    status: { $ne: TAG_STATUS.DELETED },
  }).lean();

  if (existing) {
    throw new AppError('标签名称已存在', 409, 'TAG_NAME_DUPLICATE');
  }

  const tag = new Tag({
    name: params.name,
    sortOrder: params.sortOrder ?? 0,
    status: TAG_STATUS.ENABLED,
  });
  await tag.save();
  return tag.toObject();
}

/**
 * 分页查询标签列表
 * 管理员可查看全部状态，支持按 status / isRecommended 筛选
 *
 * @param {{ status?: string, isRecommended?: boolean, page: number, pageSize: number, sort: string }} params
 * @returns {Promise<{ items: object[], total: number, page: number, pageSize: number }>}
 */
export async function listTags(params) {
  const { status, isRecommended, page, pageSize, sort = '-createdAt' } = params;
  const query = {};

  if (status) query.status = status;
  if (isRecommended !== undefined) query.isRecommended = isRecommended;

  const skip = (page - 1) * pageSize;

  const [items, total] = await Promise.all([
    Tag.find(query)
      .sort(sort)
      .skip(skip)
      .limit(pageSize)
      .lean(),
    Tag.countDocuments(query),
  ]);

  return { items, total, page, pageSize };
}

/**
 * 根据 ID 查询单个标签
 * @param {string} id
 * @returns {Promise<object>}
 * @throws {AppError} 标签不存在时抛出 404
 */
export async function getTag(id) {
  const tag = await Tag.findById(id).lean();
  if (!tag) {
    throw new AppError('标签不存在', 404, 'TAG_NOT_FOUND');
  }
  return tag;
}

/**
 * 更新标签元信息（名称、排序、推荐状态）
 * 重命名不改变标签身份，既有漫画关联和推荐位置保持不变
 *
 * @param {string} id
 * @param {{ name?: string, sortOrder?: number, status?: string, isRecommended?: boolean, recommendedOrder?: number }} updates
 * @returns {Promise<object>}
 * @throws {AppError} 标签不存在（404）、名称冲突（409）、状态冲突（409）
 */
export async function updateTag(id, updates) {
  const tag = await Tag.findById(id);
  if (!tag) {
    throw new AppError('标签不存在', 404, 'TAG_NOT_FOUND');
  }

  // 已删除标签不可编辑
  if (tag.status === TAG_STATUS.DELETED) {
    throw new AppError('已删除的标签不可编辑，请先恢复', 409, 'TAG_STATUS_CONFLICT');
  }

  // 重命名时检查名称冲突（排除自身）
  if (updates.name !== undefined && updates.name !== tag.name) {
    const duplicate = await Tag.findOne({
      _id: { $ne: id },
      name: updates.name,
      status: { $ne: TAG_STATUS.DELETED },
    }).lean();
    if (duplicate) {
      throw new AppError('标签名称已存在', 409, 'TAG_NAME_DUPLICATE');
    }
  }

  // 状态转换校验
  if (updates.status !== undefined) {
    validateTagStatusTransition(tag.status, updates.status);
  }

  // 当标签被停用或删除时，自动退出推荐名单
  if (updates.status === TAG_STATUS.DISABLED || updates.status === TAG_STATUS.DELETED) {
    updates.isRecommended = false;
  }

  const setFields = {};
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      setFields[key] = value;
    }
  }

  return Tag.findByIdAndUpdate(
    id,
    { $set: setFields },
    { returnDocument: 'after', lean: true },
  );
}

/**
 * 软删除标签 — enabled/disabled → deleted
 * 关联漫画不受影响
 *
 * @param {string} id
 * @returns {Promise<object|null>}
 * @throws {AppError} 标签不存在（404）、状态冲突（409）
 */
export async function deleteTag(id) {
  const tag = await Tag.findById(id);
  if (!tag) {
    throw new AppError('标签不存在', 404, 'TAG_NOT_FOUND');
  }

  if (tag.status === TAG_STATUS.DELETED) {
    throw new AppError('标签已删除', 409, 'TAG_STATUS_CONFLICT');
  }

  return Tag.findByIdAndUpdate(
    id,
    { $set: { status: TAG_STATUS.DELETED, isRecommended: false } },
    { returnDocument: 'after', lean: true },
  );
}

/**
 * 恢复已删除标签 — deleted → disabled
 * 恢复后不自动重新发布，也不自动恢复推荐资格
 *
 * @param {string} id
 * @returns {Promise<object>}
 * @throws {AppError} 标签不存在（404）、状态冲突（409）
 */
export async function restoreTag(id) {
  const tag = await Tag.findById(id);
  if (!tag) {
    throw new AppError('标签不存在', 404, 'TAG_NOT_FOUND');
  }

  if (tag.status !== TAG_STATUS.DELETED) {
    throw new AppError('只有已删除的标签才能恢复', 409, 'TAG_STATUS_CONFLICT');
  }

  return Tag.findByIdAndUpdate(
    id,
    { $set: { status: TAG_STATUS.DISABLED, isRecommended: false } },
    { returnDocument: 'after', lean: true },
  );
}

/**
 * 永久清理标签 — 物理删除标签记录
 * 仅能作用于已删除标签；关联漫画不受影响
 *
 * @param {string} id
 * @returns {Promise<void>}
 * @throws {AppError} 标签不存在（404）、状态冲突（409）
 */
export async function permanentDeleteTag(id) {
  const tag = await Tag.findById(id);
  if (!tag) {
    throw new AppError('标签不存在', 404, 'TAG_NOT_FOUND');
  }

  if (tag.status !== TAG_STATUS.DELETED) {
    throw new AppError('只有已删除的标签才能永久清理', 409, 'TAG_STATUS_CONFLICT');
  }

  await Tag.findByIdAndDelete(id);
}

/**
 * 标签状态转换校验
 * - enabled ↔ disabled：允许
 * - enabled/disabled → deleted：允许
 * - deleted → disabled：允许（恢复）
 * - 不允许直接跳回 enabled
 *
 * @param {string} currentStatus
 * @param {string} targetStatus
 * @throws {AppError} 非法状态转换
 */
function validateTagStatusTransition(currentStatus, targetStatus) {
  if (currentStatus === targetStatus) {
    throw new AppError('标签已是该状态', 409, 'TAG_STATUS_CONFLICT');
  }

  // editable 状态之间允许切换（enabled ↔ disabled）
  if (
    (currentStatus === TAG_STATUS.ENABLED || currentStatus === TAG_STATUS.DISABLED) &&
    (targetStatus === TAG_STATUS.ENABLED || targetStatus === TAG_STATUS.DISABLED)
  ) {
    return;
  }

  // 允许从 enabled/disabled 转到 deleted（但应通过 deleteTag，不通过 updateTag）
  if (targetStatus === TAG_STATUS.DELETED) {
    throw new AppError('请使用删除接口删除标签', 409, 'TAG_STATUS_CONFLICT');
  }

  throw new AppError('无效的状态转换', 409, 'TAG_STATUS_CONFLICT');
}
