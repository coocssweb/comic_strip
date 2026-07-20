const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildPublicApiPath,
  hasDiscoverContent,
  mergeEpisodeCards,
  sortPanels,
  toEpisodeCard,
  toReaderEpisode,
  toTopicCard,
  toRankingRow,
} = require('../miniprogram/utils/discovery-view-model');
const { discoveryApi } = require('../miniprogram/api/discovery');

function createWxRequestMock(response) {
  let capturedOptions;

  global.wx = {
    request(options) {
      capturedOptions = options;
      options.success({ statusCode: 200, data: response });
      options.complete();
    },
  };

  return () => capturedOptions;
}

test('公开 API 路径会编码资源标识并忽略空查询参数', () => {
  assert.equal(
    buildPublicApiPath('/episodes/漫画 01', { cursor: null, limit: 20 }),
    '/episodes/%E6%BC%AB%E7%94%BB%2001?limit=20',
  );
});

test('单话卡片保留公开互动计数并为缺失字段提供安全默认值', () => {
  const episode = toEpisodeCard({
    id: 'episode-1',
    title: '雨天便利店',
    series: { id: 'series-1', name: '城市角落' },
    themeTag: { id: 'tag-1', name: '治愈' },
    thumbnailUrl: 'https://cdn.example.com/episode-1.jpg',
    publishedAt: '2026-07-20T08:00:00.000Z',
    counts: { likeCount: 12, commentCount: 3 },
  });

  assert.deepEqual(episode, {
    id: 'episode-1',
    title: '雨天便利店',
    seriesId: 'series-1',
    seriesName: '城市角落',
    themeTagName: '治愈',
    thumbnailUrl: 'https://cdn.example.com/episode-1.jpg',
    publishedAt: '2026-07-20T08:00:00.000Z',
    likeCount: 12,
    favoriteCount: 0,
    commentCount: 3,
    shareCount: 0,
  });
});

test('阅读器总是按画格位置排序，并保留可访问的替代文本', () => {
  assert.deepEqual(
    sortPanels([
      { position: 3, imageUrl: 'https://cdn.example.com/3.jpg', altText: null },
      { position: 1, imageUrl: 'https://cdn.example.com/1.jpg', altText: '开场' },
      { position: 2, imageUrl: 'https://cdn.example.com/2.jpg' },
      { position: 4, imageUrl: 'https://cdn.example.com/4.jpg', altText: '结尾' },
    ]),
    [
      { position: 1, imageUrl: 'https://cdn.example.com/1.jpg', altText: '开场' },
      { position: 2, imageUrl: 'https://cdn.example.com/2.jpg', altText: '' },
      { position: 3, imageUrl: 'https://cdn.example.com/3.jpg', altText: '' },
      { position: 4, imageUrl: 'https://cdn.example.com/4.jpg', altText: '结尾' },
    ],
  );
});

test('专题和月榜会转换为发现页需要的稳定视图字段', () => {
  assert.deepEqual(
    toTopicCard({
      id: 'topic-1',
      title: '夏夜散步',
      summary: null,
      coverImageUrl: 'https://cdn.example.com/topic.jpg',
    }),
    {
      id: 'topic-1',
      title: '夏夜散步',
      summary: '',
      coverImageUrl: 'https://cdn.example.com/topic.jpg',
    },
  );

  assert.deepEqual(
    toRankingRow({
      rank: 1,
      series: { id: 'series-1', name: '城市角落', authorByline: '小林' },
      heat: 42,
      shareCount: 7,
    }),
    {
      rank: 1,
      seriesId: 'series-1',
      seriesName: '城市角落',
      authorByline: '小林',
      heat: 42,
      shareCount: 7,
    },
  );
});

test('首页续页会排除已加载的重复单话', () => {
  const currentEpisodes = [
    { id: 'episode-1', title: '第一话' },
    { id: 'episode-2', title: '第二话' },
  ];
  const nextEpisodes = [
    { id: 'episode-2', title: '第二话（重复）' },
    { id: 'episode-3', title: '第三话' },
  ];

  assert.deepEqual(mergeEpisodeCards(currentEpisodes, nextEpisodes), [
    { id: 'episode-1', title: '第一话' },
    { id: 'episode-2', title: '第二话' },
    { id: 'episode-3', title: '第三话' },
  ]);
});

test('发现页仅在三个公开分区都为空时显示空状态', () => {
  assert.equal(hasDiscoverContent({ series: [], topics: [], ranking: [] }), false);
  assert.equal(hasDiscoverContent({ series: [], topics: [{ id: 'topic-1' }], ranking: [] }), true);
});

test('匿名读取不携带授权头，并按契约请求公开单话列表', async () => {
  const getCapturedOptions = createWxRequestMock({ code: 'OK', data: { items: [], nextCursor: null } });

  await discoveryApi.listEpisodes({ cursor: 'next cursor', limit: 20 });

  assert.deepEqual(getCapturedOptions(), {
    url: 'http://127.0.0.1:3000/api/v1/episodes?cursor=next%20cursor&limit=20',
    method: 'GET',
    data: undefined,
    header: { 'content-type': 'application/json' },
    success: getCapturedOptions().success,
    fail: getCapturedOptions().fail,
    complete: getCapturedOptions().complete,
  });
  delete global.wx;
});

test('公开单话不可用时保留后端中文错误语义', async () => {
  createWxRequestMock({ code: 'RESOURCE_NOT_FOUND', message: '内容不存在或已不可用。', data: null });

  await assert.rejects(discoveryApi.getEpisode('offline-episode'), {
    message: '内容不存在或已不可用。',
  });
  delete global.wx;
});

test('阅读器保留后端相邻单话流向作为纵向切换目标', () => {
  assert.deepEqual(
    toReaderEpisode({
      id: 'current',
      series: {},
      themeTag: {},
      counts: {},
      panels: [],
      readerFlow: { previousEpisodeId: 'previous', nextEpisodeId: 'next' },
    }),
    {
      id: 'current',
      title: '',
      seriesId: '',
      seriesName: '',
      themeTagName: '',
      thumbnailUrl: '',
      publishedAt: '',
      likeCount: 0,
      favoriteCount: 0,
      commentCount: 0,
      shareCount: 0,
      summary: '',
      panels: [],
      previousEpisodeId: 'previous',
      nextEpisodeId: 'next',
    },
  );
});

test('分享时调用匿名计数接口', async () => {
  const getCapturedOptions = createWxRequestMock({ code: 'OK', data: { shareCount: 8 } });

  await discoveryApi.recordEpisodeShare('episode-1');

  assert.equal(getCapturedOptions().url, 'http://127.0.0.1:3000/api/v1/episodes/episode-1/shares');
  assert.equal(getCapturedOptions().method, 'POST');
  delete global.wx;
});
