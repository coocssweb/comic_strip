const test = require('node:test');
const assert = require('node:assert/strict');

const { request } = require('../miniprogram/utils/request');
const { getReaderSession } = require('../miniprogram/utils/reader-session-storage');

function loadReaderApi() {
  try {
    return require('../miniprogram/api/reader').readerApi;
  } catch {
    return null;
  }
}

function loadReaderViewModel() {
  try {
    return require('../miniprogram/utils/reader-view-model');
  } catch {
    return null;
  }
}

test('公开请求不会携带读者会话令牌', async () => {
  let capturedOptions;
  global.wx = {
    getStorageSync(key) {
      return key === 'reader_session' ? { sessionToken: 'reader-token' } : null;
    },
    request(options) {
      capturedOptions = options;
      options.success({ statusCode: 200, data: { code: 'OK', data: {} } });
      options.complete();
    },
  };

  await request({ path: '/episodes/episode-1' });

  assert.deepEqual(capturedOptions.header, {
    'content-type': 'application/json',
  });
  delete global.wx;
});

test('需要读者身份的请求会携带会话令牌', async () => {
  let capturedOptions;
  global.wx = {
    getStorageSync() {
      return { sessionToken: 'reader-token' };
    },
    request(options) {
      capturedOptions = options;
      options.success({ statusCode: 200, data: { code: 'OK', data: {} } });
      options.complete();
    },
  };

  await request({ path: '/me/favorites', includeReaderSession: true });

  assert.equal(capturedOptions.header.Authorization, 'Bearer reader-token');
  delete global.wx;
});

test('过期读者会话不会继续用于请求', () => {
  global.wx = {
    getStorageSync() {
      return { sessionToken: 'expired-token', expiresAt: '2020-01-01T00:00:00.000Z' };
    },
    removeStorageSync() {},
  };

  assert.equal(getReaderSession(), null);
  delete global.wx;
});

test('读者互动 API 会按契约调用点赞和我的收藏端点', async () => {
  const readerApi = loadReaderApi();
  assert.ok(readerApi, '需要提供读者互动 API 封装');
  if (!readerApi) {
    return;
  }

  const capturedRequests = [];
  global.wx = {
    getStorageSync() {
      return { sessionToken: 'reader-token' };
    },
    request(options) {
      capturedRequests.push(options);
      options.success({ statusCode: 200, data: { code: 'OK', data: { isLiked: true, likeCount: 1 } } });
      options.complete();
    },
  };

  await readerApi.createEpisodeLike('episode 1');
  await readerApi.listMyFavorites({ cursor: 'next cursor', limit: 20 });

  assert.equal(capturedRequests[0].method, 'POST');
  assert.equal(capturedRequests[0].url, 'http://127.0.0.1:3000/api/v1/episodes/episode%201/likes');
  assert.equal(capturedRequests[1].method, 'GET');
  assert.equal(capturedRequests[1].url, 'http://127.0.0.1:3000/api/v1/me/favorites?cursor=next%20cursor&limit=20');
  delete global.wx;
});

test('评论视图模型保留授权状态和可打开的单话标识', () => {
  const readerViewModel = loadReaderViewModel();
  assert.ok(readerViewModel, '需要提供读者互动视图模型');
  if (!readerViewModel) {
    return;
  }

  assert.deepEqual(
    readerViewModel.toCommentItem({
      id: 'comment-1',
      episodeId: 'episode-1',
      content: '好喜欢这篇',
      createdAt: '2026-07-20T08:00:00.000Z',
      author: { displayName: '小夏', avatarUrl: 'https://cdn.example.com/avatar.jpg' },
      likeCount: 2,
      viewerState: { isLiked: true, canDelete: true },
    }),
    {
      id: 'comment-1',
      episodeId: 'episode-1',
      content: '好喜欢这篇',
      createdAt: '2026-07-20T08:00:00.000Z',
      authorName: '小夏',
      authorAvatarUrl: 'https://cdn.example.com/avatar.jpg',
      likeCount: 2,
      isLiked: true,
      canDelete: true,
    },
  );
});

test('我的评论续页会排除已有条目和同页重复条目', () => {
  const readerViewModel = loadReaderViewModel();
  assert.ok(readerViewModel, '需要提供读者互动视图模型');
  if (!readerViewModel) {
    return;
  }

  assert.deepEqual(
    readerViewModel.mergeReaderItems(
      [{ id: 'comment-1' }],
      [{ id: 'comment-1' }, { id: 'comment-2' }, { id: 'comment-2' }],
    ),
    [{ id: 'comment-1' }, { id: 'comment-2' }],
  );
});
