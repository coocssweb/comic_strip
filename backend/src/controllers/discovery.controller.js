import { buildTimestampCursorFilter, createNextCursor } from '../content/pagination.js';
import {
  getEpisodeCounts,
  getViewerStates,
  toEpisodeSummary,
} from '../content/episode-presenter.js';
import {
  getMonthRange,
  getShanghaiMonth,
  rankMonthlySeries,
} from '../discovery/monthly-ranking.js';
import { Comment } from '../models/comment.model.js';
import { CommentLike } from '../models/comment-like.model.js';
import { Episode } from '../models/episode.model.js';
import { EpisodeLike } from '../models/episode-like.model.js';
import { EpisodeShare } from '../models/episode-share.model.js';
import { ComicSeries } from '../models/series.model.js';
import { Topic } from '../models/topic.model.js';
import { ApiError } from '../utils/api-error.js';

const PUBLISHED_FILTER = { status: 'published' };

function getReaderId(ctx) {
  return ctx.state.auth?.role === 'reader' ? ctx.state.auth.subjectId : null;
}

async function findPublicEpisodeOrFail(episodeId) {
  const episode = await Episode.findOne({ _id: episodeId, ...PUBLISHED_FILTER })
    .populate('seriesId themeTagId')
    .lean();

  if (!episode) {
    throw new ApiError(404, 'RESOURCE_NOT_FOUND', '内容不存在或已不可用。');
  }

  return episode;
}

async function toEpisodeSummaries(episodes) {
  const episodeIds = episodes.map(({ _id }) => _id);
  const counts = await getEpisodeCounts(episodeIds);

  return episodes.map((episode) => toEpisodeSummary(episode, counts.get(String(episode._id))));
}

function toPublicSeries(series, latestEpisode) {
  return {
    id: String(series._id),
    name: series.name,
    summary: series.summary,
    authorByline: series.authorByline,
    thumbnailUrl: latestEpisode.thumbnailUrl,
    latestEpisode,
  };
}

async function aggregateSeriesEventCounts(model, range) {
  return model.aggregate([
    { $match: { createdAt: { $gte: range.start, $lt: range.end } } },
    {
      $lookup: {
        from: 'comic_episodes',
        localField: 'episodeId',
        foreignField: '_id',
        as: 'episode',
      },
    },
    { $unwind: '$episode' },
    { $match: { 'episode.status': 'published' } },
    { $group: { _id: '$episode.seriesId', count: { $sum: 1 } } },
  ]);
}

async function aggregateCommentLikeCounts(range) {
  return CommentLike.aggregate([
    { $match: { createdAt: { $gte: range.start, $lt: range.end } } },
    { $lookup: { from: 'comments', localField: 'commentId', foreignField: '_id', as: 'comment' } },
    { $unwind: '$comment' },
    {
      $lookup: {
        from: 'comic_episodes',
        localField: 'comment.episodeId',
        foreignField: '_id',
        as: 'episode',
      },
    },
    { $unwind: '$episode' },
    { $match: { 'episode.status': 'published' } },
    { $group: { _id: '$episode.seriesId', count: { $sum: 1 } } },
  ]);
}

function createMetricMap(rows) {
  return new Map(rows.map(({ _id, count }) => [String(_id), count]));
}

export async function listPublishedEpisodes(ctx) {
  const { cursor, limit } = ctx.state.query;
  const cursorFilter = buildTimestampCursorFilter({ cursor, field: 'publishedAt' });

  if (cursor && !cursorFilter) {
    throw new ApiError(400, 'VALIDATION_ERROR', '请求参数不合法。');
  }

  const episodes = await Episode.find({ ...PUBLISHED_FILTER, ...(cursorFilter || {}) })
    .sort({ publishedAt: -1, _id: -1 })
    .limit(limit + 1)
    .populate('seriesId themeTagId')
    .lean();
  const items = episodes.slice(0, limit);

  ctx.ok({
    items: await toEpisodeSummaries(items),
    nextCursor: episodes.length > limit ? createNextCursor(items.at(-1), 'publishedAt') : null,
  });
}

export async function getPublishedEpisode(ctx) {
  const episode = await findPublicEpisodeOrFail(ctx.params.episodeId);
  const readerId = getReaderId(ctx);
  const [summary, viewerStates, navigation] = await Promise.all([
    toEpisodeSummaries([episode]),
    getViewerStates([episode._id], readerId),
    Promise.all([
      Episode.findOne({
        ...PUBLISHED_FILTER,
        $or: [
          { publishedAt: { $gt: episode.publishedAt } },
          { publishedAt: episode.publishedAt, _id: { $gt: episode._id } },
        ],
      })
        .sort({ publishedAt: 1, _id: 1 })
        .select('_id')
        .lean(),
      Episode.findOne({
        ...PUBLISHED_FILTER,
        $or: [
          { publishedAt: { $lt: episode.publishedAt } },
          { publishedAt: episode.publishedAt, _id: { $lt: episode._id } },
        ],
      })
        .sort({ publishedAt: -1, _id: -1 })
        .select('_id')
        .lean(),
    ]),
  ]);
  const [previousEpisode, nextEpisode] = navigation;

  ctx.ok({
    ...summary[0],
    summary: episode.summary,
    panels: episode.panels,
    viewerState: viewerStates.get(String(episode._id)),
    readerFlow: {
      previousEpisodeId: previousEpisode ? String(previousEpisode._id) : null,
      nextEpisodeId: nextEpisode ? String(nextEpisode._id) : null,
    },
  });
}

export async function listPublicSeries(ctx) {
  const { cursor, limit } = ctx.state.query;
  const publishedSeriesIds = await Episode.distinct('seriesId', PUBLISHED_FILTER);
  const cursorFilter = buildTimestampCursorFilter({ cursor, field: 'createdAt' });

  if (cursor && !cursorFilter) {
    throw new ApiError(400, 'VALIDATION_ERROR', '请求参数不合法。');
  }

  const seriesList = await ComicSeries.find({
    _id: { $in: publishedSeriesIds },
    ...(cursorFilter || {}),
  })
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .lean();
  const items = seriesList.slice(0, limit);
  const episodes = await Episode.find({
    ...PUBLISHED_FILTER,
    seriesId: { $in: items.map(({ _id }) => _id) },
  })
    .sort({ publishedAt: -1, _id: -1 })
    .populate('seriesId themeTagId')
    .lean();
  const latestEpisodes = new Map();

  for (const episode of episodes) {
    if (!latestEpisodes.has(String(episode.seriesId._id))) {
      latestEpisodes.set(String(episode.seriesId._id), episode);
    }
  }

  const episodeSummaries = new Map(
    (await toEpisodeSummaries([...latestEpisodes.values()])).map((episode) => [
      episode.series.id,
      episode,
    ]),
  );

  ctx.ok({
    items: items.map((series) => {
      const latestEpisode = episodeSummaries.get(String(series._id));
      return toPublicSeries(series, latestEpisode);
    }),
    nextCursor: seriesList.length > limit ? createNextCursor(items.at(-1), 'createdAt') : null,
  });
}

export async function getPublicSeries(ctx) {
  const series = await ComicSeries.findById(ctx.params.seriesId).lean();

  if (!series) {
    throw new ApiError(404, 'RESOURCE_NOT_FOUND', '内容不存在或已不可用。');
  }

  const { cursor, limit } = ctx.state.query;
  const cursorFilter = buildTimestampCursorFilter({ cursor, field: 'publishedAt' });

  if (cursor && !cursorFilter) {
    throw new ApiError(400, 'VALIDATION_ERROR', '请求参数不合法。');
  }

  const episodes = await Episode.find({
    ...PUBLISHED_FILTER,
    seriesId: series._id,
    ...(cursorFilter || {}),
  })
    .sort({ publishedAt: -1, _id: -1 })
    .limit(limit + 1)
    .populate('seriesId themeTagId')
    .lean();
  const items = episodes.slice(0, limit);

  if (items.length === 0 && !cursor) {
    throw new ApiError(404, 'RESOURCE_NOT_FOUND', '内容不存在或已不可用。');
  }

  const summaries = await toEpisodeSummaries(items);
  ctx.ok({
    series: {
      id: String(series._id),
      name: series.name,
      summary: series.summary,
      authorByline: series.authorByline,
      thumbnailUrl: summaries[0]?.thumbnailUrl || null,
    },
    episodes: summaries,
    nextCursor: episodes.length > limit ? createNextCursor(items.at(-1), 'publishedAt') : null,
  });
}

export async function listPublicTopics(ctx) {
  const { cursor, limit } = ctx.state.query;
  const publishedEpisodeIds = await Episode.distinct('_id', PUBLISHED_FILTER);
  const cursorFilter = buildTimestampCursorFilter({ cursor, field: 'createdAt' });

  if (cursor && !cursorFilter) {
    throw new ApiError(400, 'VALIDATION_ERROR', '请求参数不合法。');
  }

  const topics = await Topic.find({
    episodeIds: { $in: publishedEpisodeIds },
    ...(cursorFilter || {}),
  })
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .lean();
  const items = topics.slice(0, limit);
  ctx.ok({
    items: items.map((topic) => toTopicResponse(topic)),
    nextCursor: topics.length > limit ? createNextCursor(items.at(-1), 'createdAt') : null,
  });
}

function toTopicResponse(topic) {
  return {
    id: String(topic._id),
    title: topic.title,
    summary: topic.summary,
    coverImageUrl: topic.coverImageUrl,
  };
}

export async function getPublicTopic(ctx) {
  const topic = await Topic.findById(ctx.params.topicId).lean();

  if (!topic) {
    throw new ApiError(404, 'RESOURCE_NOT_FOUND', '内容不存在或已不可用。');
  }

  const episodes = await Episode.find({ _id: { $in: topic.episodeIds }, ...PUBLISHED_FILTER })
    .populate('seriesId themeTagId')
    .lean();
  const episodeById = new Map(episodes.map((episode) => [String(episode._id), episode]));
  const orderedEpisodes = topic.episodeIds
    .map((episodeId) => episodeById.get(String(episodeId)))
    .filter(Boolean);

  if (orderedEpisodes.length === 0) {
    throw new ApiError(404, 'RESOURCE_NOT_FOUND', '内容不存在或已不可用。');
  }

  ctx.ok({ topic: toTopicResponse(topic), episodes: await toEpisodeSummaries(orderedEpisodes) });
}

export async function getMonthlySeriesRanking(ctx) {
  const month = ctx.state.query.month || getShanghaiMonth();
  const range = getMonthRange(month);

  if (!range) {
    throw new ApiError(400, 'VALIDATION_ERROR', '请求参数不合法。');
  }

  const [likes, comments, commentLikes, shares] = await Promise.all([
    aggregateSeriesEventCounts(EpisodeLike, range),
    aggregateSeriesEventCounts(Comment, range),
    aggregateCommentLikeCounts(range),
    aggregateSeriesEventCounts(EpisodeShare, range),
  ]);
  const likeCounts = createMetricMap(likes);
  const commentCounts = createMetricMap(comments);
  const commentLikeCounts = createMetricMap(commentLikes);
  const shareCounts = createMetricMap(shares);
  const seriesIds = new Set([
    ...likeCounts.keys(),
    ...commentCounts.keys(),
    ...commentLikeCounts.keys(),
    ...shareCounts.keys(),
  ]);
  const series = await ComicSeries.find({ _id: { $in: [...seriesIds] } }).lean();
  const ranking = rankMonthlySeries(
    series.map((seriesItem) => {
      const seriesId = String(seriesItem._id);
      return {
        series: {
          id: seriesId,
          name: seriesItem.name,
          authorByline: seriesItem.authorByline,
        },
        likeCount: likeCounts.get(seriesId) || 0,
        commentCount: commentCounts.get(seriesId) || 0,
        commentLikeCount: commentLikeCounts.get(seriesId) || 0,
        shareCount: shareCounts.get(seriesId) || 0,
      };
    }),
  );

  ctx.ok({ month, items: ranking });
}
