import Router from '@koa/router';

import { getAdminCookieName } from '../utils/admin-cookie.js';
import { createAuditAppender } from '../../audit/audit-appender.js';
import { handleLogin } from './admin-auth/handle-login.js';
import { handleLogout } from './admin-auth/handle-logout.js';
import { handleSession } from './admin-auth/handle-session.js';
import { handlePassword } from './admin-auth/handle-password.js';

/**
 * 管理员认证路由：使用 @koa/router 声明式注册端点。
 *
 * @param {{
 *   config: object,
 *   logger: object,
 *   getDb: () => import('mongodb').Db,
 * }} options
 * @returns {import('@koa/router')}
 */
export function createAdminAuthRouter({ config, logger, getDb }) {
  const router = new Router({ prefix: '/admin/auth' });

  // 路由匹配后同步 routeTemplate 供访问日志使用
  router.use(async (ctx, next) => {
    await next();
    if (ctx._matchedRoute) {
      ctx.state.routeTemplate = ctx._matchedRoute;
    }
  });

  /** 构建请求级依赖，桥接 handler 的 (ctx, deps) 签名 */
  function buildDeps(ctx) {
    const db = getDb();
    const requestId = ctx.state.requestId;
    const cookieName = getAdminCookieName(config.nodeEnv);
    const auditAppend = createAuditAppender(db, config, logger, requestId);
    return { config, logger, db, requestId, cookieName, auditAppend };
  }

  router.post('/login', (ctx) => handleLogin(ctx, buildDeps(ctx)));
  router.post('/logout', (ctx) => handleLogout(ctx, buildDeps(ctx)));
  router.get('/session', (ctx) => handleSession(ctx, buildDeps(ctx)));
  router.patch('/password', (ctx) => handlePassword(ctx, buildDeps(ctx)));

  return router;
}
