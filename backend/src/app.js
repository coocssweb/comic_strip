// Koa 应用装配 — 创建应用实例，按顺序注册中间件与路由

import Koa from 'koa';
import cors from '@koa/cors';
import bodyParser from 'koa-bodyparser';
import { loadConfig } from './config/index.js';
import { createLogger, createLoggerMiddleware } from './middlewares/logger.middleware.js';
import errorHandlerMiddleware from './middlewares/error-handler.middleware.js';
import requestIdMiddleware from './middlewares/request-id.middleware.js';
import securityHeadersMiddleware from './middlewares/security-headers.middleware.js';
import healthRouter from './routes/health.route.js';
import authRouter from './routes/auth.route.js';

/**
 * 创建并装配 Koa 应用。
 * 返回 { app, logger, config } 供 server.js 使用。
 */
export function createApp() {
  const config = loadConfig();
  const logger = createLogger(config.logLevel);

  const app = new Koa();

  // ── 将 config 和 logger 挂载到 ctx，供控制器和 Service 使用 ──
  app.context.config = config;
  app.context.logger = logger;

  // 中间件注册顺序至关重要：
  // 1. 错误处理 — 最外层，捕获所有下游异常
  app.use(errorHandlerMiddleware);

  // 2. 请求 ID — 确保后续中间件和日志都能获取 requestId
  app.use(requestIdMiddleware);

  // 3. 请求日志 — 记录每个请求的方法、路由、状态码和耗时
  app.use(createLoggerMiddleware(logger));

  // 4. 安全响应头
  app.use(securityHeadersMiddleware);

  // 5. CORS — 开发环境放宽，生产环境严格限定来源
  app.use(
    cors({
      origin(ctx) {
        // 开发环境允许 localhost 及配置的开发来源
        if (config.nodeEnv === 'development') {
          const allowed = [config.adminWebOrigin, 'http://localhost:5173', 'http://localhost:3000'];
          if (allowed.includes(ctx.request.origin)) {
            return ctx.request.origin;
          }
        }
        // 生产环境仅允许配置的 ADMIN_WEB_ORIGIN
        return config.adminWebOrigin;
      },
      credentials: true,
    }),
  );

  // 6. Body 解析 — 限制 JSON 大小为 8 KiB（登录端点需求）
  app.use(bodyParser({
    jsonLimit: '8kb',
  }));

  // 7. 业务路由

  // 健康检查路由
  app.use(healthRouter.routes());
  app.use(healthRouter.allowedMethods());

  // 管理员认证路由 — 统一设置 Cache-Control: no-store
  app.use(async (ctx, next) => {
    if (ctx.path.startsWith('/admin/auth')) {
      ctx.set('Cache-Control', 'no-store');
    }
    await next();
  });
  app.use(authRouter.routes());
  app.use(authRouter.allowedMethods());

  return { app, logger, config };
}
