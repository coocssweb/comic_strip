// 管理员 JWT 鉴权中间件 — 基于 koa-jwt，从 Cookie 提取 admin_session token
// 有效 token 放行并挂载 decoded payload 到 ctx.state.admin
// 无效/缺失 token 返回 401 ADMIN_AUTH_REQUIRED

import jwt from 'koa-jwt';

/**
 * 创建管理员鉴权中间件。
 * 用于保护 /api/v1/comics、/api/v1/series 等管理端 API 路由。
 *
 * @param {object} config - 运行配置，需包含 adminJwtSecret
 * @returns {Function} Koa 中间件函数，附带 .unless 方法用于排除路由
 */
export function createAdminAuthMiddleware(config) {
  const jwtMiddleware = jwt({
    secret: config.adminJwtSecret,
    // 与 utils/jwt.js 保持一致，限定 issuer 防止跨系统 token 混用
    issuer: 'comic-strip-admin',
    // 从 admin_session Cookie 中读取 JWT token
    cookie: 'admin_session',
    // 不设置 passthrough，缺失/无效 token 时直接抛 401
    key: 'admin',
  });

  /**
   * 包装 koa-jwt 中间件，将其 401 异常转换为项目统一错误格式。
   */
  async function adminAuthMiddleware(ctx, next) {
    try {
      await jwtMiddleware(ctx, next);
    } catch (err) {
      // koa-jwt 在 token 缺失/无效/过期时抛出 401 错误
      if (err.status === 401) {
        ctx.status = 401;
        ctx.body = {
          code: 'ADMIN_AUTH_REQUIRED',
          message: '认证已失效，请重新登录',
          requestId: ctx.state?.requestId,
        };
        return;
      }
      throw err;
    }
  }

  // 保留 koa-jwt 的 .unless 方法，支持路由排除
  adminAuthMiddleware.unless = jwtMiddleware.unless;

  return adminAuthMiddleware;
}

export default createAdminAuthMiddleware;
