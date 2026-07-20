import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';

import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import Joi from 'joi';
import Router from 'koa-router';
import { errorMiddleware } from '../src/middlewares/error.middleware.js';
import { responseMiddleware } from '../src/middlewares/response.middleware.js';
import { validate } from '../src/middlewares/validate.middleware.js';

const OBJECT_ID = '507f1f77bcf86cd799439011';

function createValidationApp() {
  const app = new Koa();
  const router = new Router();
  const paramsOnlySchema = Joi.object({
    params: Joi.object({ resourceId: Joi.string().hex().length(24).required() }).required(),
  });
  const bodySchema = Joi.object({
    body: Joi.object({ content: Joi.string().required() }).required(),
    params: Joi.object({ resourceId: Joi.string().hex().length(24).required() }).required(),
  });

  router.delete('/resources/:resourceId', validate(paramsOnlySchema), (ctx) => {
    ctx.ok({ deleted: true });
  });
  router.patch('/resources/:resourceId', validate(bodySchema), (ctx) => {
    ctx.ok({ updated: true });
  });

  app.use(errorMiddleware);
  app.use(bodyParser());
  app.use(responseMiddleware);
  app.use(router.routes());
  return app;
}

async function requestValidationApp(path, options) {
  const app = createValidationApp();
  const server = http.createServer(app.callback());

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  try {
    return await fetch(`http://127.0.0.1:${port}${path}`, options);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('真实 HTTP DELETE 未携带请求体时，params-only 路由允许 bodyparser 的空对象', async () => {
  const response = await requestValidationApp(`/resources/${OBJECT_ID}`, { method: 'DELETE' });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    code: 'OK',
    message: '',
    data: { deleted: true },
  });
});

test('真实 HTTP DELETE 显式携带空 JSON 时，params-only 路由返回 VALIDATION_ERROR', async () => {
  const response = await requestValidationApp(`/resources/${OBJECT_ID}`, {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });

  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, 'VALIDATION_ERROR');
});

test('真实 HTTP 请求中带 body 的路由仍拒绝未知字段', async () => {
  const response = await requestValidationApp(`/resources/${OBJECT_ID}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ content: '测试', unexpected: 'value' }),
  });

  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, 'VALIDATION_ERROR');
});
