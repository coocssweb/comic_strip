import Joi from 'joi';
import Router from 'koa-router';
import { createCosPresignedUpload } from '../controllers/cos.controller.js';
import { requireAdminAuth } from '../middlewares/auth.middleware.js';
import { validateBody } from '../middlewares/validate.middleware.js';

const cosRouter = new Router({ prefix: '/api/v1/admin/cos' });

const presignSchema = Joi.object({
  fileName: Joi.string().trim().min(1).max(255).required(),
  contentType: Joi.string().valid('image/jpeg', 'image/png', 'image/webp').required(),
  contentLength: Joi.number().integer().positive().required(),
});

cosRouter.post('/presign', requireAdminAuth, validateBody(presignSchema), createCosPresignedUpload);

export { cosRouter };
