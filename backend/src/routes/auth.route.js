import Joi from 'joi';
import Router from 'koa-router';
import { loginAsAdmin, loginWithWechat, logout } from '../controllers/auth.controller.js';
import { requireAuthenticated } from '../middlewares/auth.middleware.js';
import { validateBody } from '../middlewares/validate.middleware.js';

const authRouter = new Router({ prefix: '/api/v1' });

const wechatLoginSchema = Joi.object({
  code: Joi.string().trim().min(1).max(200).required(),
  profile: Joi.object({
    displayName: Joi.string().trim().min(1).max(100).required(),
    avatarUrl: Joi.string()
      .uri({ scheme: ['https'] })
      .required(),
  }),
});

const adminLoginSchema = Joi.object({
  username: Joi.string().trim().min(1).max(100).required(),
  password: Joi.string().min(1).max(200).required(),
});

authRouter.post('/auth/wechat/login', validateBody(wechatLoginSchema), loginWithWechat);
authRouter.post('/admin/auth/login', validateBody(adminLoginSchema), loginAsAdmin);
authRouter.post('/auth/logout', requireAuthenticated, logout);

export { authRouter };
