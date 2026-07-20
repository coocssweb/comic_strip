import assert from 'node:assert/strict';
import test from 'node:test';

import { Comment } from '../src/models/comment.model.js';
import { ensureRegisteredModelIndexes, REGISTERED_MODELS } from '../src/models/index.js';

test('受控索引迁移先补建全部模型索引，再删除旧的有效评论索引', async (testContext) => {
  const originalCreateIndexes = REGISTERED_MODELS.map((model) => model.createIndexes);
  const originalDropIndex = Comment.collection.dropIndex;
  const calls = [];
  REGISTERED_MODELS.forEach((model) => {
    model.createIndexes = async () => {
      calls.push(`create:${model.modelName}`);
    };
  });
  Comment.collection.dropIndex = async (indexName) => {
    calls.push(`drop:${indexName}`);
  };
  testContext.after(() => {
    REGISTERED_MODELS.forEach((model, index) => {
      model.createIndexes = originalCreateIndexes[index];
    });
    Comment.collection.dropIndex = originalDropIndex;
  });

  await ensureRegisteredModelIndexes();

  assert.equal(calls.filter((call) => call.startsWith('create:')).length, REGISTERED_MODELS.length);
  assert.ok(calls.indexOf('create:Comment') < calls.indexOf('drop:active_comments_by_created_at'));
  assert.ok(calls.includes('drop:active_comments_by_created_at'));
});

test('新评论索引创建失败时，受控迁移不会删除旧的有效评论索引', async (testContext) => {
  const originalCreateIndexes = REGISTERED_MODELS.map((model) => model.createIndexes);
  const originalDropIndex = Comment.collection.dropIndex;
  let droppedLegacyIndex = false;
  REGISTERED_MODELS.forEach((model) => {
    model.createIndexes = async () => {
      if (model === Comment) {
        throw new Error('索引创建失败');
      }
    };
  });
  Comment.collection.dropIndex = async () => {
    droppedLegacyIndex = true;
  };
  testContext.after(() => {
    REGISTERED_MODELS.forEach((model, index) => {
      model.createIndexes = originalCreateIndexes[index];
    });
    Comment.collection.dropIndex = originalDropIndex;
  });

  await assert.rejects(ensureRegisteredModelIndexes(), /索引创建失败/);

  assert.equal(droppedLegacyIndex, false);
});

test('旧的有效评论索引不存在时，受控迁移保持幂等', async (testContext) => {
  const originalCreateIndexes = REGISTERED_MODELS.map((model) => model.createIndexes);
  const originalDropIndex = Comment.collection.dropIndex;
  let dropAttempts = 0;
  REGISTERED_MODELS.forEach((model) => {
    model.createIndexes = async () => {};
  });
  Comment.collection.dropIndex = async () => {
    dropAttempts += 1;
    const error = new Error('索引不存在');
    error.code = 27;
    throw error;
  };
  testContext.after(() => {
    REGISTERED_MODELS.forEach((model, index) => {
      model.createIndexes = originalCreateIndexes[index];
    });
    Comment.collection.dropIndex = originalDropIndex;
  });

  await ensureRegisteredModelIndexes();

  assert.equal(dropAttempts, 1);
});
