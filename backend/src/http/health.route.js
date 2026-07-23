/**
 * 创建不经过 CORS 的进程存活与依赖就绪路由。
 *
 * @param {{readiness: {isDraining: () => boolean, verify: () => Promise<void>}}} options
 * @returns {import('koa').Middleware}
 */
export function createHealthRoutes({ readiness }) {
  return async function healthRoutes(ctx, next) {
    if (ctx.method === 'GET' && ctx.path === '/health/live') {
      ctx.state.routeTemplate = '/health/live';
      ctx.status = 200;
      ctx.body = { status: 'ok' };
      return;
    }

    if (ctx.method === 'GET' && ctx.path === '/health/ready') {
      ctx.state.routeTemplate = '/health/ready';
      if (readiness.isDraining()) {
        ctx.status = 503;
        ctx.body = { status: 'unavailable' };
        return;
      }

      try {
        await readiness.verify();
        ctx.status = 200;
        ctx.body = { status: 'ok' };
      } catch {
        ctx.status = 503;
        ctx.body = { status: 'unavailable' };
      }
      return;
    }

    await next();
  };
}
