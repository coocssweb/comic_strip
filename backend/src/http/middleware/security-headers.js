const CONTENT_SECURITY_POLICY = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'";

/**
 * 创建覆盖全部响应的固定安全头中间件。
 *
 * @param {{nodeEnv: string}} config
 * @returns {import('koa').Middleware}
 */
export function createSecurityHeaders({ nodeEnv }) {
  return async function securityHeaders(ctx, next) {
    ctx.set('X-Content-Type-Options', 'nosniff');
    ctx.set('Referrer-Policy', 'no-referrer');
    ctx.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    ctx.set('Content-Security-Policy', CONTENT_SECURITY_POLICY);
    if (nodeEnv === 'production') {
      ctx.set('Strict-Transport-Security', 'max-age=31536000');
    }
    await next();
  };
}
