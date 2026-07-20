import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rankMonthlySeries } from '../src/discovery/monthly-ranking.js';

test('月榜先按热度、再按分享数、最后按系列 ID 升序稳定排序', () => {
  const ranking = rankMonthlySeries([
    {
      series: { id: 'series-c', name: 'C', authorByline: '作者 C' },
      likeCount: 2,
      commentCount: 1,
      commentLikeCount: 1,
      shareCount: 4,
    },
    {
      series: { id: 'series-b', name: 'B', authorByline: '作者 B' },
      likeCount: 3,
      commentCount: 1,
      commentLikeCount: 0,
      shareCount: 4,
    },
    {
      series: { id: 'series-a', name: 'A', authorByline: '作者 A' },
      likeCount: 3,
      commentCount: 1,
      commentLikeCount: 0,
      shareCount: 4,
    },
  ]);

  assert.deepEqual(
    ranking.map(({ rank, series, heat, shareCount }) => ({
      rank,
      seriesId: series.id,
      heat,
      shareCount,
    })),
    [
      { rank: 1, seriesId: 'series-a', heat: 8, shareCount: 4 },
      { rank: 2, seriesId: 'series-b', heat: 8, shareCount: 4 },
      { rank: 3, seriesId: 'series-c', heat: 8, shareCount: 4 },
    ],
  );
});

test('月榜以四类互动事件之和作为热度', () => {
  assert.deepEqual(
    rankMonthlySeries([
      {
        series: { id: 'series-a', name: 'A', authorByline: '作者 A' },
        likeCount: 2,
        commentCount: 3,
        commentLikeCount: 5,
        shareCount: 7,
      },
    ]),
    [
      {
        rank: 1,
        series: { id: 'series-a', name: 'A', authorByline: '作者 A' },
        heat: 17,
        shareCount: 7,
      },
    ],
  );
});
