// 漫画路由 — 仅做路径与中间件绑定，不含业务逻辑

import Router from '@koa/router';
import { createAdminAuthMiddleware } from '../middlewares/admin-auth.middleware.js';
import * as comicController from '../controllers/comic.controller.js';
import * as imageController from '../controllers/image.controller.js';

/**
 * 创建漫画路由
 * @param {object} config - 运行配置，需包含 adminJwtSecret
 * @returns {Router} Koa Router 实例
 */
export function createComicRouter(config) {
  const router = new Router({ prefix: '/api/v1/comics' });
  const adminAuth = createAdminAuthMiddleware(config);

  // 公开接口：查询列表和单本漫画（仅返回已发布）
  router.get('/', comicController.list);
  router.get('/:id', comicController.getById);

  // 管理员接口：创建和更新漫画
  router.post('/', adminAuth, comicController.create);
  router.put('/:id', adminAuth, comicController.update);

  // 管理员接口：漫画生命周期操作（发布/下架/删除/恢复）
  router.post('/:id/publish', adminAuth, comicController.publish);
  router.post('/:id/unpublish', adminAuth, comicController.unpublish);
  router.delete('/:id', adminAuth, comicController.remove);
  router.post('/:id/restore', adminAuth, comicController.restore);

  // 图片路由：STS 凭证申请 + 图片绑定（均为管理员专用）
  router.post('/:id/images/sts', adminAuth, imageController.requestSts);
  router.put('/:id/images', adminAuth, imageController.bindImages);

  return router;
}
