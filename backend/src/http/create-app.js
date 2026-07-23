import { performance } from 'node:perf_hooks';

import Koa from 'koa';

import { createHealthRoutes } from './health.route.js';
import { requestContext } from './middleware/request-context.js';
import { createSecurityHeaders } from './middleware/security-headers.js';

function createErrorBoundary(logger) {
  return async function errorBoundary(ctx, next) {
    try {
      await next();
    } catch {
      ctx.status = 500;
      ctx.body = { status: 'unavailable' };
      logger.error('请求处理失败', {
        requestId: ctx.state.requestId,
        method: ctx.method,
        route: ctx.state.routeTemplate ?? 'unmatched',
        status: 500,
        errorSummary: '未处理的服务异常',
      });
    }
  };
}

function createAccessLogger(logger) {
  return async function accessLogger(ctx, next) {
    const startedAt = performance.now();
    await next();

    const route = ctx.state.routeTemplate ?? 'unmatched';
    const isSuccessfulHealthCheck = ctx.status < 400
      && (route === '/health/live' || route === '/health/ready');
    if (isSuccessfulHealthCheck) {
      return;
    }

    logger.info('HTTP 请求完成', {
      requestId: ctx.state.requestId,
      method: ctx.method,
      route,
      status: ctx.status,
      durationMs: Math.max(0, Math.round((performance.now() - startedAt) * 1000) / 1000),
    });
  };
}

/**
 * 中间件顺序是运行安全契约：请求标识与安全头必须覆盖错误响应，访问日志只观察最终状态。
 *
 * @param {{config: object, logger: object, readiness: {isDraining: () => boolean, verify: () => Promise<void>}}} options
 * @returns {Koa}
 */
export function createApp({ config, logger, readiness }) {
  const app = new Koa();
  app.proxy = false;

  app.use(requestContext);
  app.use(createSecurityHeaders(config));
  app.use(createErrorBoundary(logger));
  app.use(createAccessLogger(logger));
  app.use(createHealthRoutes({ readiness }));

  return app;
}
