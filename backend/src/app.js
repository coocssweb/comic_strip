// Koa Ӧ��װ�� �� ����Ӧ��ʵ������˳��ע���м����·��

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
import { createComicRouter } from './routes/comic.route.js';
import { createSeriesRouter } from './routes/series.route.js';
import { createTagRouter } from './routes/tag.route.js';

/**
 * ������װ�� Koa Ӧ�á�
 * ���� { app, logger, config } �� server.js ʹ�á�
 */
export function createApp(customConfig) {
    const config = customConfig ?? loadConfig();
  const logger = createLogger(config.logLevel);

  const app = new Koa();

  // ���� �� config �� logger ���ص� ctx������������ Service ʹ�� ����
  app.context.config = config;
  app.context.logger = logger;

  // �м��ע��˳��������Ҫ��
  // 1. ������ �� ����㣬�������������쳣
  app.use(errorHandlerMiddleware);

  // 2. ���� ID �� ȷ�������м������־���ܻ�ȡ requestId
  app.use(requestIdMiddleware);

  // 3. ������־ �� ��¼ÿ������ķ�����·�ɡ�״̬��ͺ�ʱ
  app.use(createLoggerMiddleware(logger));

  // 4. ��ȫ��Ӧͷ
  app.use(securityHeadersMiddleware);

  // 5. CORS �� ���������ſ�����������ϸ��޶���Դ
  app.use(
    cors({
      origin(ctx) {
        // ������������ localhost �����õĿ�����Դ
        if (config.nodeEnv === 'development') {
          const allowed = [config.adminWebOrigin, 'http://localhost:5173', 'http://localhost:3000'];
          if (allowed.includes(ctx.request.origin)) {
            return ctx.request.origin;
          }
        }
        // �����������������õ� ADMIN_WEB_ORIGIN
        return config.adminWebOrigin;
      },
      credentials: true,
    }),
  );

  // 6. Body ���� �� ���� JSON ��СΪ 8 KiB����¼�˵�����
  app.use(bodyParser({
    jsonLimit: '1mb', // �� 8kb ������ 1mb��֧��ͼƬ�����󣨺�����+����ͼƬ key ���飩
  }));

  // 7. ҵ��·��

  // �������·��
  app.use(healthRouter.routes());
  app.use(healthRouter.allowedMethods());

  // ����Ա��֤·�� �� ͳһ���� Cache-Control: no-store
  app.use(async (ctx, next) => {
    if (ctx.path.startsWith('/admin/auth')) {
      ctx.set('Cache-Control', 'no-store');
    }
    await next();
  });
  app.use(authRouter.routes());
  app.use(authRouter.allowedMethods());

  // ����·��
  const comicRouter = createComicRouter(config);
  app.use(comicRouter.routes());
  app.use(comicRouter.allowedMethods());

  // 连载路由
  const seriesRouter = createSeriesRouter(config);
  app.use(seriesRouter.routes());
  app.use(seriesRouter.allowedMethods());

  // 标签路由
  const tagRouter = createTagRouter(config);
  app.use(tagRouter.routes());
  app.use(tagRouter.allowedMethods());

  return { app, logger, config };
}

