import { findPrimaryAdmin } from '../../db/admin-repository.js';
import { computeCsrfTokenHash, findAdminSession } from '../../db/session-repository.js';
import { verifyAdminJwt } from '../../security/jwt.js';

/**
 * 管理端默认拒绝门禁中间件：负责精确来源、管理会话鉴权、已认证写请求 CSRF 校验及未匹配路由隔离。
 *
 * @param {{
 *   config: object,
 *   logger: object,
 *   getDb: () => import('mongodb').Db,
 * }} options
 * @returns {import('koa').Middleware}
 */
export function createAdminGatekeeper({ config, logger, getDb }) {
  return async function adminGatekeeper(ctx, next) {
    if (!ctx.path.startsWith('/admin/')) {
      await next();
      return;
    }

    const requestId = ctx.state.requestId;
    const origin = ctx.get('Origin');

    if (origin !== config.adminWebOrigin) {
      ctx.status = 403;
      ctx.body = {
        code: 'ORIGIN_NOT_ALLOWED',
        message: '请求来源不受信任',
        requestId,
      };
      return;
    }

    ctx.set('Access-Control-Allow-Origin', config.adminWebOrigin);
    ctx.set('Access-Control-Allow-Credentials', 'true');
    ctx.set('Vary', 'Origin');
    ctx.set('Access-Control-Expose-Headers', 'X-Request-ID');

    if (ctx.method === 'OPTIONS') {
      ctx.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
      ctx.set('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token');
      ctx.set('Access-Control-Max-Age', '600');
      ctx.status = 204;
      return;
    }

    if (ctx.path === '/admin/auth/login' && ctx.method === 'POST') {
      await next();
      return;
    }

    const isLogout = ctx.path === '/admin/auth/logout' && ctx.method === 'POST';
    const cookieName = config.nodeEnv === 'production' ? '__Host-admin_session' : 'admin_session';
    const token = ctx.cookies.get(cookieName);

    const clearCookieAndReject = (status, code, message) => {
      ctx.cookies.set(cookieName, null, {
        path: '/',
        expires: new Date(0),
        overwrite: true,
      });
      ctx.status = status;
      ctx.body = { code, message, requestId };
    };

    if (!token) {
      if (isLogout) {
        await next();
        return;
      }
      clearCookieAndReject(401, 'ADMIN_AUTH_REQUIRED', '管理会话已失效，请重新登录');
      return;
    }

    let payload;
    try {
      payload = verifyAdminJwt(token, config.adminJwtSecret);
    } catch {
      if (isLogout) {
        await next();
        return;
      }
      clearCookieAndReject(401, 'ADMIN_AUTH_REQUIRED', '管理会话已失效，请重新登录');
      return;
    }

    let db;
    let sessionDoc;
    let adminDoc;
    try {
      db = getDb();
      if (!db) {
        throw new Error('数据库尚未初始化');
      }
      [sessionDoc, adminDoc] = await Promise.all([
        findAdminSession(db, payload.jti),
        findPrimaryAdmin(db),
      ]);
    } catch (err) {
      logger.error('会话鉴权依赖故障', { requestId, errorSummary: err.message });
      ctx.status = 503;
      ctx.body = {
        code: 'SERVICE_UNAVAILABLE',
        message: '服务暂时不可用，请稍后再试',
        requestId,
      };
      return;
    }

    if (!sessionDoc || !adminDoc
      || sessionDoc.sessionGeneration !== adminDoc.sessionGeneration
      || payload.sessionGeneration !== adminDoc.sessionGeneration) {
      if (isLogout) {
        await next();
        return;
      }
      clearCookieAndReject(401, 'ADMIN_AUTH_REQUIRED', '管理会话已失效，请重新登录');
      return;
    }

    const now = new Date();
    if (now > new Date(sessionDoc.absoluteExpiresAt) || now > new Date(sessionDoc.idleExpiresAt)) {
      if (isLogout) {
        await next();
        return;
      }
      clearCookieAndReject(401, 'ADMIN_AUTH_REQUIRED', '管理会话已失效，请重新登录');
      return;
    }

    ctx.state.admin = adminDoc;
    ctx.state.adminSession = sessionDoc;
    ctx.state.jwtPayload = payload;

    const isWriteMethod = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(ctx.method);

    if (isWriteMethod) {
      const headerCsrf = ctx.get('X-CSRF-Token');
      if (!headerCsrf || computeCsrfTokenHash(headerCsrf) !== sessionDoc.csrfTokenHash) {
        ctx.status = 403;
        ctx.body = {
          code: 'CSRF_VALIDATION_FAILED',
          message: 'CSRF 令牌校验失败',
          requestId,
        };
        return;
      }
    }

    await next();

    if (ctx.status === 404 && !ctx.body) {
      ctx.status = 404;
      ctx.body = {
        code: 'NOT_FOUND',
        message: '路由不存在',
        requestId,
      };
    }
  };
}
