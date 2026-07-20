import assert from 'node:assert/strict';
import test from 'node:test';

import Joi from 'joi';
import { validate } from '../src/middlewares/validate.middleware.js';

const OBJECT_ID = '507f1f77bcf86cd799439011';

function paramsSchema(name) {
  return Joi.object({
    params: Joi.object({ [name]: Joi.string().hex().length(24).required() }).required(),
  });
}

async function runParamsValidation(schema, params, body = undefined) {
  const ctx = { request: { body }, params };
  let didContinue = false;

  await validate(schema)(ctx, async () => {
    didContinue = true;
  });

  return { ctx, didContinue };
}

test('无请求体的管理员评论删除路径参数可以通过通用校验', async () => {
  const result = await runParamsValidation(paramsSchema('commentId'), { commentId: OBJECT_ID });

  assert.equal(result.didContinue, true);
  assert.equal(result.ctx.params.commentId, OBJECT_ID);
  assert.equal(result.ctx.request.body, undefined);
});

test('无请求体的读者单话路径参数可以通过通用校验', async () => {
  const result = await runParamsValidation(paramsSchema('episodeId'), { episodeId: OBJECT_ID });

  assert.equal(result.didContinue, true);
  assert.equal(result.ctx.params.episodeId, OBJECT_ID);
});

test('路径参数路由拒绝任意已提供的请求体', async () => {
  await assert.rejects(
    runParamsValidation(
      paramsSchema('commentId'),
      { commentId: OBJECT_ID },
      { unexpected: 'value' },
    ),
    (error) => {
      assert.equal(error.status, 400);
      assert.equal(error.code, 'VALIDATION_ERROR');
      return true;
    },
  );
});

test('路径参数对象仍拒绝未知字段', async () => {
  await assert.rejects(
    runParamsValidation(paramsSchema('commentId'), {
      commentId: OBJECT_ID,
      unexpected: 'value',
    }),
    (error) => {
      assert.equal(error.status, 400);
      assert.equal(error.code, 'VALIDATION_ERROR');
      return true;
    },
  );
});

test('显式声明的请求体仍拒绝嵌套未知字段', async () => {
  const schema = Joi.object({
    body: Joi.object({ content: Joi.string().required() }).required(),
    params: Joi.object({ commentId: Joi.string().hex().length(24).required() }).required(),
  });
  const ctx = {
    request: { body: { content: '测试', unexpected: 'value' } },
    params: { commentId: OBJECT_ID },
  };

  await assert.rejects(
    validate(schema)(ctx, async () => {}),
    (error) => {
      assert.equal(error.status, 400);
      assert.equal(error.code, 'VALIDATION_ERROR');
      return true;
    },
  );
});
