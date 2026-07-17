import Router from 'koa-router';
import { userRouter } from './user.route.js';

const router = new Router();

router.get('/health', (ctx) => {
  ctx.success(200, '服务运行正常', { status: 'ok' });
});

router.use(userRouter.routes(), userRouter.allowedMethods());

export { router };
