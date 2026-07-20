import Router from 'koa-router';
import { authRouter } from './auth.route.js';
import { contentRouter } from './content.route.js';
import { cosRouter } from './cos.route.js';
import { discoveryRouter } from './discovery.route.js';
import { interactionRouter } from './interaction.route.js';
import { userRouter } from './user.route.js';

const router = new Router();

router.get('/health', (ctx) => {
  ctx.success(200, '服务运行正常', { status: 'ok' });
});

router.use(userRouter.routes(), userRouter.allowedMethods());
router.use(authRouter.routes(), authRouter.allowedMethods());
router.use(cosRouter.routes(), cosRouter.allowedMethods());
router.use(contentRouter.routes(), contentRouter.allowedMethods());
router.use(discoveryRouter.routes(), discoveryRouter.allowedMethods());
router.use(interactionRouter.routes(), interactionRouter.allowedMethods());

export { router };
