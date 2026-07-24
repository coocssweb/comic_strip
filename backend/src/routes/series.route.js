// 连载路由 — 仅做路径与中间件绑定，不含业务逻辑

import Router from '@koa/router';
import { createAdminAuthMiddleware } from '../middlewares/admin-auth.middleware.js';
import * as seriesController from '../controllers/series.controller.js';

/**
 * 创建连载路由
 * @param {object} config - 运行配置，需包含 adminJwtSecret
 * @returns {Router} Koa Router 实例
 */
export function createSeriesRouter(config) {
  const router = new Router({ prefix: '/api/v1/series' });
  const adminAuth = createAdminAuthMiddleware(config);

  // 公开接口：查询列表和单本连载（仅返回已发布）
  router.get('/', seriesController.list);
  router.get('/:id', seriesController.getById);

  // 管理员接口：创建和更新连载
  router.post('/', adminAuth, seriesController.create);
  router.put('/:id', adminAuth, seriesController.update);

  // 管理员接口：连载生命周期操作（发布/下架/删除/恢复）
  router.post('/:id/publish', adminAuth, seriesController.publish);
  router.post('/:id/unpublish', adminAuth, seriesController.unpublish);
  router.delete('/:id', adminAuth, seriesController.remove);
  router.post('/:id/restore', adminAuth, seriesController.restore);

  return router;
}
