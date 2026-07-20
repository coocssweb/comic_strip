import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  deleteAdminComment,
  listAdminComments,
  toAdminComment,
} from '../src/controllers/admin-comment.controller.js';
import { Comment } from '../src/models/comment.model.js';

function createAdminContext(query) {
  return {
    state: { query },
    ok(response) {
      this.response = response;
    },
  };
}

function createCommentQuery(records, calls) {
  return {
    sort(sort) {
      calls.sort = sort;
      return this;
    },
    limit(limit) {
      calls.limit = limit;
      return this;
    },
    populate(path) {
      calls.populate.push(path);
      return this;
    },
    async lean() {
      return records;
    },
  };
}

test('toAdminComment 将有效评论映射为管理端视图模型', () => {
  assert.deepEqual(
    toAdminComment({
      _id: 'comment-1',
      content: '测试评论',
      createdAt: new Date('2026-07-20T00:00:00.000Z'),
      readerId: { _id: 'reader-1', displayName: '读者', avatarUrl: null },
      episodeId: { _id: 'episode-1', title: '第一话', status: 'published' },
      deletedAt: null,
      deletedByRole: null,
      deletedById: null,
    }),
    {
      id: 'comment-1',
      content: '测试评论',
      createdAt: '2026-07-20T00:00:00.000Z',
      author: { id: 'reader-1', displayName: '读者', avatarUrl: null },
      episode: { id: 'episode-1', title: '第一话', status: 'published' },
      audit: null,
    },
  );
});

test('toAdminComment 将删除审计信息映射为管理端视图模型', () => {
  assert.deepEqual(
    toAdminComment({
      _id: 'comment-2',
      content: '已删除评论',
      createdAt: new Date('2026-07-20T00:00:00.000Z'),
      readerId: { _id: 'reader-2', displayName: '读者二', avatarUrl: 'https://example.com/avatar.png' },
      episodeId: { _id: 'episode-2', title: '第二话', status: 'unpublished' },
      deletedAt: new Date('2026-07-20T01:00:00.000Z'),
      deletedByRole: 'admin',
      deletedById: 'admin-1',
    }),
    {
      id: 'comment-2',
      content: '已删除评论',
      createdAt: '2026-07-20T00:00:00.000Z',
      author: {
        id: 'reader-2',
        displayName: '读者二',
        avatarUrl: 'https://example.com/avatar.png',
      },
      episode: { id: 'episode-2', title: '第二话', status: 'unpublished' },
      audit: {
        deletedAt: '2026-07-20T01:00:00.000Z',
        deletedBy: { role: 'admin', id: 'admin-1' },
      },
    },
  );
});

test('toAdminComment 在关联记录已不存在时保留可用 ID 并返回可空字段', () => {
  assert.deepEqual(
    toAdminComment({
      _id: 'comment-orphan',
      content: '关联已删除的评论',
      createdAt: new Date('2026-07-20T00:00:00.000Z'),
      readerId: null,
      episodeId: null,
      deletedAt: null,
      deletedByRole: null,
      deletedById: null,
    }),
    {
      id: 'comment-orphan',
      content: '关联已删除的评论',
      createdAt: '2026-07-20T00:00:00.000Z',
      author: { id: null, displayName: null, avatarUrl: null },
      episode: { id: null, title: null, status: null },
      audit: null,
    },
  );
});

test('管理端评论列表按视图筛选并使用创建时间游标稳定翻页', async (testContext) => {
  const originalFind = Comment.find;
  const calls = { filters: [], populate: [] };
  const records = [
    {
      _id: 'comment-2',
      content: '较新评论',
      createdAt: new Date('2026-07-20T02:00:00.000Z'),
      readerId: { _id: 'reader-2', displayName: '读者二', avatarUrl: null },
      episodeId: { _id: 'episode-2', title: '第二话', status: 'published' },
      deletedAt: new Date('2026-07-20T03:00:00.000Z'),
      deletedByRole: 'admin',
      deletedById: 'admin-1',
    },
    {
      _id: 'comment-1',
      content: '较早评论',
      createdAt: new Date('2026-07-20T01:00:00.000Z'),
      readerId: { _id: 'reader-1', displayName: '读者一', avatarUrl: null },
      episodeId: { _id: 'episode-1', title: '第一话', status: 'published' },
      deletedAt: new Date('2026-07-20T01:30:00.000Z'),
      deletedByRole: 'admin',
      deletedById: 'admin-1',
    },
  ];

  Comment.find = (filter) => {
    calls.filters.push(filter);
    return createCommentQuery(records, calls);
  };
  testContext.after(() => {
    Comment.find = originalFind;
  });

  const firstContext = createAdminContext({ cursor: undefined, limit: 1, view: 'deleted' });
  await listAdminComments(firstContext);

  assert.deepEqual(calls.filters[0], { deletedAt: { $type: 'date' } });
  assert.deepEqual(calls.sort, { createdAt: -1, _id: -1 });
  assert.equal(calls.limit, 2);
  assert.deepEqual(
    calls.populate.map((options) => options.path),
    ['readerId', 'episodeId'],
  );
  assert.equal(firstContext.response.items[0].id, 'comment-2');
  assert.ok(firstContext.response.nextCursor);

  const secondContext = createAdminContext({
    cursor: firstContext.response.nextCursor,
    limit: 1,
    view: 'active',
  });
  await listAdminComments(secondContext);

  assert.deepEqual(calls.filters[1], {
    $or: [
      { createdAt: { $lt: new Date('2026-07-20T02:00:00.000Z') } },
      { createdAt: new Date('2026-07-20T02:00:00.000Z'), _id: { $lt: 'comment-2' } },
    ],
    deletedAt: null,
  });
});

test('管理端评论列表的关联 transform 在缺失记录时保留原 ID', async (testContext) => {
  const originalFind = Comment.find;
  const calls = { filters: [], populate: [] };
  Comment.find = (filter) => {
    calls.filters.push(filter);
    return createCommentQuery([], calls);
  };
  testContext.after(() => {
    Comment.find = originalFind;
  });

  await listAdminComments(createAdminContext({ cursor: undefined, limit: 20, view: 'active' }));

  const readerPopulate = calls.populate.find((options) => options.path === 'readerId');
  const episodePopulate = calls.populate.find((options) => options.path === 'episodeId');
  const readerId = readerPopulate.transform(null, 'reader-absent');
  const episodeId = episodePopulate.transform(null, 'episode-absent');

  assert.deepEqual(
    toAdminComment({
      _id: 'comment-orphan',
      content: '关联记录缺失',
      createdAt: new Date('2026-07-20T00:00:00.000Z'),
      readerId,
      episodeId,
      deletedAt: null,
      deletedByRole: null,
      deletedById: null,
    }),
    {
      id: 'comment-orphan',
      content: '关联记录缺失',
      createdAt: '2026-07-20T00:00:00.000Z',
      author: { id: 'reader-absent', displayName: null, avatarUrl: null },
      episode: { id: 'episode-absent', title: null, status: null },
      audit: null,
    },
  );
});

test('管理端评论列表拒绝非法游标', async () => {
  const ctx = createAdminContext({ cursor: 'not-a-valid-cursor', limit: 20, view: 'active' });

  await assert.rejects(listAdminComments(ctx), (error) => {
    assert.equal(error.status, 400);
    assert.equal(error.code, 'VALIDATION_ERROR');
    return true;
  });
});

test('管理员删除不存在的评论返回资源不存在', async (testContext) => {
  const originalFindOneAndUpdate = Comment.findOneAndUpdate;
  const originalExists = Comment.exists;
  Comment.findOneAndUpdate = async () => null;
  Comment.exists = async () => null;
  testContext.after(() => {
    Comment.findOneAndUpdate = originalFindOneAndUpdate;
    Comment.exists = originalExists;
  });

  await assert.rejects(
    deleteAdminComment({
      params: { commentId: 'comment-missing' },
      state: { auth: { subjectId: 'admin-1' } },
    }),
    (error) => {
      assert.equal(error.status, 404);
      assert.equal(error.code, 'RESOURCE_NOT_FOUND');
      return true;
    },
  );
});

test('重复删除通过原子条件更新保留首次审计并返回已删除', async (testContext) => {
  const originalFindOneAndUpdate = Comment.findOneAndUpdate;
  const originalExists = Comment.exists;
  const calls = [];
  let storedComment = {
    _id: 'comment-1',
    deletedAt: null,
    deletedByRole: null,
    deletedById: null,
  };

  Comment.findOneAndUpdate = async (filter, update, options) => {
    calls.push({ filter, update, options });

    if (storedComment.deletedAt) {
      return null;
    }

    storedComment = { ...storedComment, ...update.$set };
    return storedComment;
  };
  Comment.exists = async () => ({ _id: storedComment._id });
  testContext.after(() => {
    Comment.findOneAndUpdate = originalFindOneAndUpdate;
    Comment.exists = originalExists;
  });

  const firstContext = {
    params: { commentId: 'comment-1' },
    state: { auth: { subjectId: 'admin-1' } },
    ok(response) {
      this.response = response;
    },
  };
  await deleteAdminComment(firstContext);
  const firstAudit = {
    deletedAt: storedComment.deletedAt,
    deletedByRole: storedComment.deletedByRole,
    deletedById: storedComment.deletedById,
  };

  await assert.rejects(
    deleteAdminComment({
      params: { commentId: 'comment-1' },
      state: { auth: { subjectId: 'admin-2' } },
    }),
    (error) => {
      assert.equal(error.status, 409);
      assert.equal(error.code, 'COMMENT_ALREADY_DELETED');
      return true;
    },
  );

  assert.deepEqual(firstContext.response, { deleted: true });
  assert.deepEqual(
    calls.map(({ filter }) => filter),
    [
      { _id: 'comment-1', deletedAt: null },
      { _id: 'comment-1', deletedAt: null },
    ],
  );
  assert.deepEqual(
    {
      deletedAt: storedComment.deletedAt,
      deletedByRole: storedComment.deletedByRole,
      deletedById: storedComment.deletedById,
    },
    firstAudit,
  );
});

test('缺少管理员会话时中间件返回管理员认证错误', async () => {
  Object.assign(process.env, {
    MONGODB_URI: 'mongodb://127.0.0.1:27017/comic-strip-test',
    WECHAT_APP_ID: 'test-wechat-app-id',
    WECHAT_APP_SECRET: 'test-wechat-app-secret',
    ADMIN_USERNAME: 'test-admin',
    ADMIN_PASSWORD_HASH: 'test-password-hash',
    SESSION_SECRET: 'test-session-secret',
    COS_BUCKET: 'test-bucket-1234567890',
    COS_REGION: 'ap-shanghai',
    COS_PUBLIC_BASE_URL: 'https://test-bucket-1234567890.cos.ap-shanghai.myqcloud.com/',
    COS_ACCESS_KEY_ID: 'test-access-key-id',
    COS_SECRET_ACCESS_KEY: 'test-secret-access-key',
  });
  const { requireAdminAuth } = await import('../src/middlewares/auth.middleware.js');

  await assert.rejects(
    requireAdminAuth(
      {
        get() {
          return '';
        },
        state: {},
      },
      async () => {},
    ),
    (error) => {
      assert.equal(error.status, 401);
      assert.equal(error.code, 'ADMIN_AUTH_REQUIRED');
      return true;
    },
  );
});

test('管理端评论契约声明参数、认证与全部错误语义', async () => {
  const contract = await readFile(
    new URL('../../.agents/skills/api-contract/admin-web-api.md', import.meta.url),
    'utf8',
  );

  assert.match(contract, /400\s+VALIDATION_ERROR/);
  assert.match(contract, /401\s+ADMIN_AUTH_REQUIRED/);
  assert.match(contract, /404\s+RESOURCE_NOT_FOUND/);
  assert.match(contract, /409\s+COMMENT_ALREADY_DELETED/);
});

test('评论审计分页索引分别覆盖有效和已删除视图', () => {
  const indexDefinitions = Comment.schema.indexes();
  const activeIndex = indexDefinitions.find(
    ([fields, options]) =>
      fields.createdAt === -1 &&
      fields._id === -1 &&
      options.partialFilterExpression?.deletedAt === null,
  );
  const deletedIndex = indexDefinitions.find(
    ([fields, options]) =>
      fields.createdAt === -1 &&
      fields._id === -1 &&
      options.partialFilterExpression?.deletedAt?.$type === 'date',
  );

  assert.ok(activeIndex);
  assert.ok(deletedIndex);
});

test('四格漫画 API 契约使用确认后的管理评论接口', async () => {
  const contract = await readFile(
    new URL('../../docs/contracts/2026-07-17-four-panel-comic-api.md', import.meta.url),
    'utf8',
  );
  const adminCommentSection = contract.slice(contract.indexOf('## 7. 管理端评论删除与 COS 预签名'));

  assert.match(adminCommentSection, /`cursor\?`、`limit\?`、`view=active\|deleted`/);
  assert.match(adminCommentSection, /400 VALIDATION_ERROR/);
  assert.match(adminCommentSection, /401 ADMIN_AUTH_REQUIRED/);
  assert.match(adminCommentSection, /404 RESOURCE_NOT_FOUND/);
  assert.match(adminCommentSection, /409 COMMENT_ALREADY_DELETED/);
  assert.doesNotMatch(adminCommentSection, /episodeId\?|includeDeleted\?/);
});
