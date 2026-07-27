// 标签路由 — 仅做路径与中间件绑定，不含业务逻辑

import Router from '@koa/router';
import { createAdminAuthMiddleware } from '../middlewares/admin-auth.middleware.js';
import * as tagController from '../controllers/tag.controller.js';

/**
 * 创建标签路由
 * @param {object} config - 运行配置，需包含 adminJwtSecret
 * @returns {Router} Koa Router 实例
 */
export function createTagRouter(config) {
  const router = new Router({ prefix: '/admin/tags' });
  const adminAuth = createAdminAuthMiddleware(config);

  // 全部标签接口均需管理员会话
  router.get('/', adminAuth, tagController.list);
  router.get('/:id', adminAuth, tagController.getById);
  router.post('/', adminAuth, tagController.create);
  router.patch('/:id', adminAuth, tagController.update);
  router.delete('/:id', adminAuth, tagController.remove);
  router.post('/:id/restore', adminAuth, tagController.restore);
  router.delete('/:id/permanent', adminAuth, tagController.permanentDelete);

  return router;
}
