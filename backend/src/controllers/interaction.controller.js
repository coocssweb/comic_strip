import { getEpisodeCounts, toEpisodeSummary } from '../content/episode-presenter.js';
import { buildTimestampCursorFilter, createNextCursor } from '../content/pagination.js';
import { normalizeCommentContent } from '../interactions/comment-rules.js';
import { CommentLike } from '../models/comment-like.model.js';
import { Comment } from '../models/comment.model.js';
import { EpisodeFavorite } from '../models/episode-favorite.model.js';
import { EpisodeLike } from '../models/episode-like.model.js';
import { EpisodeShare } from '../models/episode-share.model.js';
import { Episode } from '../models/episode.model.js';
import { Reader } from '../models/reader.model.js';
import { ApiError } from '../utils/api-error.js';

const PUBLISHED_EPISODE_FILTER = { status: 'published' };

function getReaderId(ctx) {
  return ctx.state.auth?.subjectId;
}

function getCursorFilterOrFail(cursor) {
  const cursorFilter = buildTimestampCursorFilter({ cursor, field: 'createdAt' });

  if (cursor && !cursorFilter) {
    throw new ApiError(400, 'VALIDATION_ERROR', '请求参数不合法。');
  }

  return cursorFilter;
}

async function findPublishedEpisodeOrFail(episodeId) {
  const episode = await Episode.findOne({ _id: episodeId, ...PUBLISHED_EPISODE_FILTER })
    .populate('seriesId themeTagId')
    .lean();

  if (!episode) {
    throw new ApiError(404, 'RESOURCE_NOT_FOUND', '内容不存在或已不可用。');
  }

  return episode;
}

async function findPublishedCommentOrFail(commentId) {
  const comment = await Comment.findOne({ _id: commentId, deletedAt: null }).populate('readerId');

  if (!comment || !(await Episode.exists({ _id: comment.episodeId, ...PUBLISHED_EPISODE_FILTER }))) {
    throw new ApiError(404, 'RESOURCE_NOT_FOUND', '内容不存在或已不可用。');
  }

  return comment;
}

function createCommentResponse(comment, { likeCount, isLiked = false, canDelete = false }) {
  return {
    id: String(comment._id),
    episodeId: String(comment.episodeId._id || comment.episodeId),
    content: comment.content,
    createdAt: comment.createdAt.toISOString(),
    author: {
      id: String(comment.readerId._id || comment.readerId),
      displayName: comment.readerId.displayName,
      avatarUrl: comment.readerId.avatarUrl,
    },
    likeCount,
    viewerState: { isLiked, canDelete },
  };
}

async function getCommentLikeCounts(commentIds) {
  if (commentIds.length === 0) {
    return new Map();
  }

  const rows = await CommentLike.aggregate([
    { $match: { commentId: { $in: commentIds } } },
    { $group: { _id: '$commentId', count: { $sum: 1 } } },
  ]);

  return new Map(rows.map(({ _id, count }) => [String(_id), count]));
}

async function getCommentViewerStates(commentIds, readerId) {
  const states = new Map(commentIds.map((commentId) => [String(commentId), false]));

  if (!readerId || commentIds.length === 0) {
    return states;
  }

  const likes = await CommentLike.find({ readerId, commentId: { $in: commentIds } })
    .select('commentId')
    .lean();

  for (const { commentId } of likes) {
    states.set(String(commentId), true);
  }

  return states;
}

function isCommentDeletableByReader(comment, readerId) {
  return Boolean(readerId) && String(comment.readerId._id || comment.readerId) === String(readerId);
}

async function createUniqueAction({ model, filter }) {
  try {
    await model.create(filter);
  } catch (error) {
    if (error?.code === 11000) {
      throw new ApiError(409, 'DUPLICATE_ACTION', '已执行过该操作。');
    }

    throw error;
  }
}

async function removeUniqueAction({ model, filter }) {
  const result = await model.deleteOne(filter);

  if (result.deletedCount === 0) {
    throw new ApiError(409, 'ACTION_NOT_FOUND', '尚未执行该操作，无法取消。');
  }
}

async function getEpisodeActionCount(model, episodeId) {
  return model.countDocuments({ episodeId });
}

async function getCommentLikeCount(commentId) {
  return CommentLike.countDocuments({ commentId });
}

async function listVisibleRecords({ model, filter, cursorFilter, limit, populate, isVisible }) {
  const visibleRecords = [];
  let pageFilter = cursorFilter;

  while (visibleRecords.length <= limit) {
    const records = await model
      .find({ ...filter, ...(pageFilter || {}) })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .populate(populate)
      .lean();

    if (records.length === 0) {
      break;
    }

    visibleRecords.push(...records.filter(isVisible));

    if (records.length <= limit) {
      break;
    }

    pageFilter = buildTimestampCursorFilter({
      cursor: createNextCursor(records.at(-1), 'createdAt'),
      field: 'createdAt',
    });
  }

  return visibleRecords;
}

async function getEpisodeSummariesFromInteractions({ model, readerId, cursor, limit }) {
  const cursorFilter = getCursorFilterOrFail(cursor);
  const records = await listVisibleRecords({
    model,
    filter: { readerId },
    cursorFilter,
    limit,
    populate: {
      path: 'episodeId',
      match: PUBLISHED_EPISODE_FILTER,
      populate: ['seriesId', 'themeTagId'],
    },
    isVisible: (record) => Boolean(record.episodeId),
  });
  const items = records.slice(0, limit);
  const episodeIds = items.map(({ episodeId }) => episodeId._id);
  const counts = await getEpisodeCounts(episodeIds);

  return {
    items: items.map(({ episodeId }) => toEpisodeSummary(episodeId, counts.get(String(episodeId._id)))),
    nextCursor: records.length > limit ? createNextCursor(records[limit - 1], 'createdAt') : null,
  };
}

async function getCommentPage({ readerId, episodeId, cursor, limit, onlyReaderComments = false }) {
  const cursorFilter = getCursorFilterOrFail(cursor);
  const records = await listVisibleRecords({
    model: Comment,
    filter: {
      ...(onlyReaderComments ? { readerId } : {}),
      ...(episodeId ? { episodeId } : {}),
      deletedAt: null,
    },
    cursorFilter,
    limit,
    populate: [
      'readerId',
      { path: 'episodeId', match: PUBLISHED_EPISODE_FILTER, select: '_id' },
    ],
    isVisible: (comment) => Boolean(comment.episodeId),
  });
  const items = records.slice(0, limit);
  const commentIds = items.map(({ _id }) => _id);
  const [likeCounts, viewerStates] = await Promise.all([
    getCommentLikeCounts(commentIds),
    getCommentViewerStates(commentIds, readerId),
  ]);

  return {
    items: items.map((comment) =>
      createCommentResponse(comment, {
        likeCount: likeCounts.get(String(comment._id)) || 0,
        isLiked: viewerStates.get(String(comment._id)),
        canDelete: isCommentDeletableByReader(comment, readerId),
      }),
    ),
    nextCursor: records.length > limit ? createNextCursor(items.at(-1), 'createdAt') : null,
  };
}

export async function createEpisodeLike(ctx) {
  const readerId = getReaderId(ctx);
  const { episodeId } = ctx.params;
  await findPublishedEpisodeOrFail(episodeId);
  await createUniqueAction({ model: EpisodeLike, filter: { readerId, episodeId } });
  ctx.ok({ isLiked: true, likeCount: await getEpisodeActionCount(EpisodeLike, episodeId) });
}

export async function deleteEpisodeLike(ctx) {
  const readerId = getReaderId(ctx);
  const { episodeId } = ctx.params;
  await findPublishedEpisodeOrFail(episodeId);
  await removeUniqueAction({ model: EpisodeLike, filter: { readerId, episodeId } });
  ctx.ok({ isLiked: false, likeCount: await getEpisodeActionCount(EpisodeLike, episodeId) });
}

export async function createEpisodeFavorite(ctx) {
  const readerId = getReaderId(ctx);
  const { episodeId } = ctx.params;
  await findPublishedEpisodeOrFail(episodeId);
  await createUniqueAction({ model: EpisodeFavorite, filter: { readerId, episodeId } });
  ctx.ok({ isFavorited: true, favoriteCount: await getEpisodeActionCount(EpisodeFavorite, episodeId) });
}

export async function deleteEpisodeFavorite(ctx) {
  const readerId = getReaderId(ctx);
  const { episodeId } = ctx.params;
  await findPublishedEpisodeOrFail(episodeId);
  await removeUniqueAction({ model: EpisodeFavorite, filter: { readerId, episodeId } });
  ctx.ok({ isFavorited: false, favoriteCount: await getEpisodeActionCount(EpisodeFavorite, episodeId) });
}

export async function createEpisodeShare(ctx) {
  const { episodeId } = ctx.params;
  await findPublishedEpisodeOrFail(episodeId);
  await EpisodeShare.create({
    episodeId,
    readerId: ctx.state.auth?.role === 'reader' ? getReaderId(ctx) : null,
  });
  ctx.ok({ shareCount: await getEpisodeActionCount(EpisodeShare, episodeId) });
}

export async function listEpisodeComments(ctx) {
  const { episodeId } = ctx.params;
  await findPublishedEpisodeOrFail(episodeId);
  ctx.ok(
    await getCommentPage({
      ...ctx.state.query,
      episodeId,
      readerId: ctx.state.auth?.subjectId,
    }),
  );
}

export async function createComment(ctx) {
  const { episodeId } = ctx.params;
  const content = normalizeCommentContent(ctx.request.body.content);

  if (!content) {
    throw new ApiError(400, 'VALIDATION_ERROR', '请求参数不合法。');
  }

  await findPublishedEpisodeOrFail(episodeId);
  const comment = await Comment.create({ readerId: getReaderId(ctx), episodeId, content });
  await comment.populate('readerId');
  ctx.ok({
    comment: createCommentResponse(comment, { likeCount: 0, canDelete: true }),
    commentCount: await Comment.countDocuments({ episodeId, deletedAt: null }),
  });
}

export async function deleteComment(ctx) {
  const comment = await findPublishedCommentOrFail(ctx.params.commentId);
  const { role, subjectId } = ctx.state.auth;

  if (role !== 'admin' && String(comment.readerId._id) !== String(subjectId)) {
    throw new ApiError(403, 'FORBIDDEN', '无权执行此操作。');
  }

  comment.deletedAt = new Date();
  comment.deletedByRole = role;
  comment.deletedById = subjectId;
  await comment.save();
  ctx.ok({ deleted: true });
}

export async function createCommentLike(ctx) {
  const readerId = getReaderId(ctx);
  const { commentId } = ctx.params;
  await findPublishedCommentOrFail(commentId);
  await createUniqueAction({ model: CommentLike, filter: { readerId, commentId } });
  ctx.ok({ isLiked: true, likeCount: await getCommentLikeCount(commentId) });
}

export async function deleteCommentLike(ctx) {
  const readerId = getReaderId(ctx);
  const { commentId } = ctx.params;
  await findPublishedCommentOrFail(commentId);
  await removeUniqueAction({ model: CommentLike, filter: { readerId, commentId } });
  ctx.ok({ isLiked: false, likeCount: await getCommentLikeCount(commentId) });
}

export async function getCurrentReader(ctx) {
  const reader = await Reader.findById(getReaderId(ctx)).lean();

  if (!reader) {
    throw new ApiError(401, 'READER_AUTH_REQUIRED', '请先微信登录后再操作。');
  }

  ctx.ok({
    reader: {
      id: String(reader._id),
      displayName: reader.displayName,
      avatarUrl: reader.avatarUrl,
      createdAt: reader.createdAt.toISOString(),
    },
  });
}

export async function listMyFavorites(ctx) {
  ctx.ok(await getEpisodeSummariesFromInteractions({ ...ctx.state.query, readerId: getReaderId(ctx), model: EpisodeFavorite }));
}

export async function listMyEpisodeLikes(ctx) {
  ctx.ok(await getEpisodeSummariesFromInteractions({ ...ctx.state.query, readerId: getReaderId(ctx), model: EpisodeLike }));
}

export async function listMyComments(ctx) {
  ctx.ok(await getCommentPage({ ...ctx.state.query, readerId: getReaderId(ctx), onlyReaderComments: true }));
}
