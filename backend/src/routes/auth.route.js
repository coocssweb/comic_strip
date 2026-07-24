// 管理员认证路由 — 仅做路径与中间件绑定，不含业务逻辑

import Router from '@koa/router';
import { login, session, logout, changePassword } from '../controllers/auth.controller.js';

const router = new Router({ prefix: '/admin/auth' });

router.post('/login', login);
router.get('/session', session);
router.post('/logout', logout);
router.patch('/password', changePassword);

export default router;
