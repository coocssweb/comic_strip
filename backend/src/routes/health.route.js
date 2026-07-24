// 健康检查路由声明 — 仅做路径绑定，不含业务逻辑

import Router from '@koa/router';
import { liveness, readiness } from '../controllers/health.controller.js';

const router = new Router();

router.get('/health/live', liveness);
router.get('/health/ready', readiness);

export default router;
