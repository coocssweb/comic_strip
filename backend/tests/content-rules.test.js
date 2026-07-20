import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  canTransitionEpisodeStatus,
  hasCompleteOrderedPanels,
} from '../src/content/episode-rules.js';
import { buildTimestampCursorFilter, createNextCursor } from '../src/content/pagination.js';

const completePanels = [
  { position: 1, imageUrl: 'https://comic.example.com/1.webp' },
  { position: 2, imageUrl: 'https://comic.example.com/2.webp' },
  { position: 3, imageUrl: 'https://comic.example.com/3.webp' },
  { position: 4, imageUrl: 'https://comic.example.com/4.webp' },
];

test('仅按 1 至 4 顺序提供四个画格时视为完整单话', () => {
  assert.equal(hasCompleteOrderedPanels(completePanels), true);
  assert.equal(
    hasCompleteOrderedPanels([
      completePanels[0],
      completePanels[2],
      completePanels[1],
      completePanels[3],
    ]),
    false,
  );
  assert.equal(hasCompleteOrderedPanels(completePanels.slice(0, 3)), false);
});

test('单话状态只能在草稿、已发布和已下架的既定路径中流转', () => {
  assert.equal(canTransitionEpisodeStatus('draft', 'published'), true);
  assert.equal(canTransitionEpisodeStatus('unpublished', 'published'), true);
  assert.equal(canTransitionEpisodeStatus('published', 'unpublished'), true);
  assert.equal(canTransitionEpisodeStatus('draft', 'unpublished'), false);
  assert.equal(canTransitionEpisodeStatus('published', 'draft'), false);
});

test('游标仅接受由服务端生成的时间和 ID 组合', () => {
  const cursor = createNextCursor(
    { _id: '507f1f77bcf86cd799439011', publishedAt: new Date('2026-07-20T00:00:00.000Z') },
    'publishedAt',
  );

  assert.deepEqual(buildTimestampCursorFilter({ cursor, field: 'publishedAt' }), {
    $or: [
      { publishedAt: { $lt: new Date('2026-07-20T00:00:00.000Z') } },
      {
        publishedAt: new Date('2026-07-20T00:00:00.000Z'),
        _id: { $lt: '507f1f77bcf86cd799439011' },
      },
    ],
  });
  assert.equal(
    buildTimestampCursorFilter({ cursor: 'not-a-cursor', field: 'publishedAt' }),
    undefined,
  );
});
