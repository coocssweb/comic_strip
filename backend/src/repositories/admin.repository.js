// 管理员仓库层 — 封装全部 admins 集合的原子操作，控制器和服务层不直接引用 Mongoose Model

import Admin from '../models/admin.model.js';
import { AppError } from '../middlewares/error-handler.middleware.js';

/**
 * 根据用户名查找管理员
 * @param {string} username
 * @returns {Promise<object|null>}
 */
export async function findByUsername(username) {
  return Admin.findOne({ username }).lean();
}

/**
 * 根据 ID 查找管理员
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export async function findById(id) {
  return Admin.findById(id).lean();
}

/**
 * 创建管理员记录
 * @param {{ username: string, passwordHash: string }} params
 * @returns {Promise<object>}
 */
export async function create({ username, passwordHash }) {
  const admin = new Admin({ username, passwordHash });
  await admin.save();
  return admin.toObject();
}

/**
 * 原子递增 sessionGeneration — 基于 CAS 的前值校验
 * 只有当当前 sessionGeneration 与 expectedGeneration 相等时才更新
 * @param {string} id - 管理员 ID
 * @param {number} expectedGeneration - 期望的当前 sessionGeneration 值
 * @returns {Promise<object>} 更新后的管理员文档
 * @throws {AppError} 当 CAS 校验失败（版本冲突）时抛出 409
 */
export async function incrementSessionGeneration(id, expectedGeneration) {
  const result = await Admin.findOneAndUpdate(
    {
      _id: id,
      sessionGeneration: expectedGeneration,
    },
    { $inc: { sessionGeneration: 1 } },
    { new: true, lean: true },
  );

  if (!result) {
    throw new AppError('会话版本冲突，请刷新重试', 409, 'SESSION_CONFLICT');
  }

  return result;
}

/**
 * 更新管理员密码哈希
 * @param {string} id
 * @param {string} passwordHash
 * @returns {Promise<object|null>}
 */
export async function updatePasswordHash(id, passwordHash) {
  return Admin.findByIdAndUpdate(id, { passwordHash }, { new: true, lean: true });
}
