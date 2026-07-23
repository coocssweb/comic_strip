import { updatePrimaryAdminPassword } from '../../../db/admin-repository.js';
import { validatePassword } from '../../../security/credential-validator.js';
import { hashPassword, verifyPassword } from '../../../security/password-hasher.js';
import { parseJsonBody, JsonBodyError } from '../../utils/parse-json-body.js';

/**
 * PATCH /admin/auth/password 端点处理器。
 *
 * 流程：请求体校验 → 当前密码验证 → 新密码合规校验 → 密码更新 → Cookie 清除 → 审计。
 *
 * @param {import('koa').Context} ctx
 * @param {{
 *   config: object,
 *   logger: object,
 *   db: import('mongodb').Db,
 *   requestId: string,
 *   cookieName: string,
 *   auditAppend: (event: object) => Promise<void>,
 * }} deps
 */
export async function handlePassword(ctx, { db, requestId, cookieName, auditAppend }) {
  let body;
  try {
    body = await parseJsonBody(ctx.req, ctx.get('Content-Type'));
  } catch (err) {
    if (err instanceof JsonBodyError) {
      ctx.status = err.status;
      ctx.body = { code: err.code, message: err.message, requestId };
      return;
    }
    throw err;
  }

  // 字段白名单 + 类型校验
  const allowedKeys = new Set(['currentPassword', 'newPassword']);
  const keys = Object.keys(body);
  const hasUnknownKeys = keys.some((k) => !allowedKeys.has(k));
  if (hasUnknownKeys
    || typeof body.currentPassword !== 'string'
    || typeof body.newPassword !== 'string'
    || body.currentPassword.length === 0
    || body.newPassword.length === 0) {
    ctx.status = 400;
    ctx.body = { code: 'VALIDATION_ERROR', message: '请求参数格式错误', requestId };
    return;
  }

  const admin = ctx.state.admin;

  // 验证当前密码
  const isCurrentPasswordValid = await verifyPassword(admin.passwordHash, body.currentPassword);
  if (!isCurrentPasswordValid) {
    await auditAppend({
      eventType: 'ADMIN_PASSWORD_CHANGE',
      outcome: 'failed',
      actorType: 'admin',
      adminId: 'primary-admin',
      reasonCode: 'CURRENT_PASSWORD_INVALID',
      sessionGeneration: admin.sessionGeneration,
    });

    ctx.status = 403;
    ctx.body = { code: 'CURRENT_PASSWORD_INVALID', message: '当前密码错误', requestId };
    return;
  }

  // 新密码合规校验
  try {
    validatePassword(body.newPassword, admin.username);
  } catch (err) {
    ctx.status = 400;
    ctx.body = { code: 'VALIDATION_ERROR', message: err.message, requestId };
    return;
  }

  // 新旧密码不能相同
  const isSamePassword = await verifyPassword(admin.passwordHash, body.newPassword);
  if (isSamePassword) {
    ctx.status = 409;
    ctx.body = { code: 'ADMIN_CREDENTIAL_UNCHANGED', message: '新密码不能与当前密码相同', requestId };
    return;
  }

  // 执行密码更新
  const newPasswordHash = await hashPassword(body.newPassword);
  const now = new Date();
  const updateResult = await updatePrimaryAdminPassword(db, {
    expectedGeneration: admin.sessionGeneration,
    newPasswordHash,
    now,
  });

  if (!updateResult.updated) {
    await auditAppend({
      eventType: 'ADMIN_PASSWORD_CHANGE',
      outcome: 'failed',
      actorType: 'admin',
      adminId: 'primary-admin',
      reasonCode: 'ADMIN_CREDENTIAL_CONFLICT',
      sessionGeneration: admin.sessionGeneration,
    });

    ctx.status = 409;
    ctx.body = { code: 'ADMIN_CREDENTIAL_CONFLICT', message: '管理员凭据已被并发修改，请重新验证', requestId };
    return;
  }

  await auditAppend({
    eventType: 'ADMIN_PASSWORD_CHANGE',
    outcome: 'succeeded',
    actorType: 'admin',
    adminId: 'primary-admin',
    sessionGeneration: updateResult.newGeneration,
  });

  await auditAppend({
    eventType: 'ADMIN_SESSION_REVOCATION',
    outcome: 'succeeded',
    actorType: 'admin',
    adminId: 'primary-admin',
    revocationScope: 'all',
    sessionGeneration: updateResult.newGeneration,
  });

  // 密码修改成功后清除当前会话 Cookie，强制重新登录
  ctx.cookies.set(cookieName, null, {
    path: '/',
    expires: new Date(0),
    overwrite: true,
  });

  ctx.status = 204;
}
