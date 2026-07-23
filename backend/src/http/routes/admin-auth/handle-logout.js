import { deleteAdminSession } from '../../../db/session-repository.js';

/**
 * POST /admin/auth/logout 端点处理器。
 *
 * 流程：会话删除 → Cookie 清除 → 审计。
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
export async function handleLogout(ctx, { logger, db, requestId, cookieName, auditAppend }) {
  const session = ctx.state.adminSession;
  const admin = ctx.state.admin;

  if (session) {
    try {
      await deleteAdminSession(db, session._id);
    } catch (err) {
      logger.error('删除会话失败', { requestId, errorSummary: err.message });
      ctx.status = 503;
      ctx.body = { code: 'SERVICE_UNAVAILABLE', message: '服务暂时不可用，请稍后再试', requestId };
      return;
    }

    await auditAppend({
      eventType: 'ADMIN_LOGOUT',
      outcome: 'succeeded',
      actorType: 'admin',
      adminId: 'primary-admin',
      sessionId: session._id,
      username: admin.username,
      revocationScope: 'current',
      sessionGeneration: admin.sessionGeneration,
    });
  }

  ctx.cookies.set(cookieName, null, {
    path: '/',
    expires: new Date(0),
    overwrite: true,
  });

  ctx.status = 204;
}
