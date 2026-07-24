// 会话仓库层 — 封装 admin_sessions 集合的全部原子操作

import Session from '../models/session.model.js';

/**
 * 根据 session ID 查找会话记录
 * @param {string} sessionId
 * @returns {Promise<object|null>}
 */
export async function findById(sessionId) {
  return Session.findById(sessionId).lean();
}

/**
 * 创建会话记录
 * @param {{ adminId: string, csrfToken: string, sessionGeneration: number, idleExpiresAt: Date }} params
 * @returns {Promise<object>}
 */
export async function create({ adminId, csrfToken, sessionGeneration, idleExpiresAt }) {
  const session = new Session({ adminId, csrfToken, sessionGeneration, idleExpiresAt });
  await session.save();
  return session.toObject();
}

/**
 * 删除会话记录（幂等 — 已删除也返回成功）
 * @param {string} sessionId
 */
export async function remove(sessionId) {
  await Session.findByIdAndDelete(sessionId);
}

/**
 * 更新会话的 idleExpiresAt（活动采样续期）
 * 仅当当前 idleExpiresAt 与 expectedIdleExpiresAt 匹配时才更新，防止并发覆盖
 * @param {string} sessionId
 * @param {Date} newIdleExpiresAt
 * @param {Date} expectedIdleExpiresAt - CAS 前值校验
 * @returns {Promise<object|null>} 更新后的文档或 null（CAS 冲突）
 */
export async function extendIdleExpiresAt(sessionId, newIdleExpiresAt, expectedIdleExpiresAt) {
  return Session.findOneAndUpdate(
    { _id: sessionId, idleExpiresAt: expectedIdleExpiresAt },
    { idleExpiresAt: newIdleExpiresAt },
    { new: true, lean: true },
  );
}

/**
 * 清理指定管理员的所有会话（用于强制登出场景，如密码重置）
 * @param {string} adminId
 */
export async function removeAllByAdminId(adminId) {
  await Session.deleteMany({ adminId });
}
