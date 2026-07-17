import Joi from 'joi';
import Router from 'koa-router';
import {
  createUser,
  deleteUser,
  getUser,
  listUsers,
  updateUser,
} from '../controllers/user.controller.js';
import { validate } from '../middlewares/validate.middleware.js';

const router = new Router({ prefix: '/api/users' });

const userIdSchema = Joi.string().hex().length(24).required();
const userBodySchema = Joi.object({
  name: Joi.string().trim().min(1).max(100),
  email: Joi.string().trim().lowercase().email(),
  age: Joi.number().integer().min(0),
});

const createUserSchema = Joi.object({
  body: userBodySchema.fork(['name', 'email'], (schema) => schema.required()).required(),
  params: Joi.object({}),
});

const updateUserSchema = Joi.object({
  body: userBodySchema.min(1).required(),
  params: Joi.object({ id: userIdSchema }),
});

const userIdParamsSchema = Joi.object({
  body: Joi.object({}),
  params: Joi.object({ id: userIdSchema }),
});

router.post('/', validate(createUserSchema), createUser);
router.get('/', listUsers);
router.get('/:id', validate(userIdParamsSchema), getUser);
router.patch('/:id', validate(updateUserSchema), updateUser);
router.delete('/:id', validate(userIdParamsSchema), deleteUser);

export { router as userRouter };
