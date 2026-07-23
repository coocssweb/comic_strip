import { touchAdminSession } from '../../../db/session-repository.js';

/**
 * GET /admin/auth/session 端点处理器。
 *
 * 流程：Content-Length 守卫 → 会话滑动延期 → 响应构造。
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
export async function handleSession(ctx, { logger, db, requestId }) {
  const contentLength = ctx.get('Content-Length');
  if (contentLength && Number(contentLength) > 0) {
    ctx.status = 400;
    ctx.body = { code: 'VALIDATION_ERROR', message: 'GET 请求不能包含请求正文', requestId };
    return;
  }

  const admin = ctx.state.admin;
  const session = ctx.state.adminSession;
  const jwtPayload = ctx.state.jwtPayload;
  const now = new Date();

  // 滑动延期：距离上次活跃超过 5 分钟时更新空闲过期时间
  const lastSeenTime = new Date(session.lastSeenAt).getTime();
  const fiveMinutesMs = 5 * 60 * 1000;
  let idleExpiresAt = new Date(session.idleExpiresAt);

  if (now.getTime() - lastSeenTime >= fiveMinutesMs) {
    const absoluteExpiresTime = new Date(session.absoluteExpiresAt).getTime();
    const candidateIdleTime = now.getTime() + 30 * 60 * 1000;
    idleExpiresAt = new Date(Math.min(candidateIdleTime, absoluteExpiresTime));

    await touchAdminSession(db, session._id, now, idleExpiresAt).catch((err) => {
      logger.error('会话滑动延期失败', { requestId, errorSummary: err.message });
    });
  }

  ctx.set('Cache-Control', 'no-store');
  ctx.status = 200;
  ctx.body = {
    admin: {
      id: 'primary-admin',
      username: admin.username,
    },
    session: {
      idleExpiresAt: idleExpiresAt.toISOString(),
      absoluteExpiresAt: new Date(session.absoluteExpiresAt).toISOString(),
    },
    serverTime: now.toISOString(),
    csrfToken: jwtPayload.csrfToken,
  };
}
