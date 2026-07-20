import { hasCompleteOrderedPanels, EPISODE_STATUS } from '../content/episode-rules.js';
import { buildTimestampCursorFilter, createNextCursor } from '../content/pagination.js';
import { getEpisodeCounts, toAdminEpisode } from '../content/episode-presenter.js';
import { env } from '../config/env.js';
import { isAllowedCosPublicUrl } from '../cos/cos-upload.js';
import { Episode } from '../models/episode.model.js';
import { Tag } from '../models/tag.model.js';
import { ApiError } from '../utils/api-error.js';
import { findSeriesOrFail } from './series.controller.js';

async function findEpisodeOrFail(episodeId) {
  const episode = await Episode.findById(episodeId).populate('seriesId themeTagId');

  if (!episode) {
    throw new ApiError(404, 'RESOURCE_NOT_FOUND', '内容不存在或已不可用。');
  }

  return episode;
}

async function ensureEpisodeReferences({ seriesId, themeTagId }) {
  if (seriesId) {
    await findSeriesOrFail(seriesId);
  }

  if (themeTagId && !(await Tag.exists({ _id: themeTagId }))) {
    throw new ApiError(400, 'VALIDATION_ERROR', '请求参数不合法。');
  }
}

function ensureAllowedPanelUrls(panels) {
  if (
    !hasCompleteOrderedPanels(panels) ||
    panels.some((panel) => !isAllowedCosPublicUrl(panel.imageUrl, env.cosPublicBaseUrl))
  ) {
    throw new ApiError(422, 'INVALID_COS_PUBLIC_URL', '图片地址不是允许的 COS 公网 HTTPS 地址。');
  }
}

function toPopulatedAdminEpisode(episode, counts) {
  return toAdminEpisode(episode, counts);
}

export async function listAdminEpisodes(ctx) {
  const { cursor, limit, status, seriesId } = ctx.state.query;
  const cursorFilter = buildTimestampCursorFilter({ cursor, field: 'createdAt' });

  if (cursor && !cursorFilter) {
    throw new ApiError(400, 'VALIDATION_ERROR', '请求参数不合法。');
  }

  const filter = { ...(cursorFilter || {}) };

  if (status) {
    filter.status = status;
  }
  if (seriesId) {
    filter.seriesId = seriesId;
  }

  const episodes = await Episode.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .populate('seriesId themeTagId')
    .lean();
  const items = episodes.slice(0, limit);
  const counts = await getEpisodeCounts(items.map(({ _id }) => _id));

  ctx.ok({
    items: items.map((episode) =>
      toPopulatedAdminEpisode(episode, counts.get(String(episode._id))),
    ),
    nextCursor: episodes.length > limit ? createNextCursor(items.at(-1), 'createdAt') : null,
  });
}

export async function createEpisode(ctx) {
  ensureAllowedPanelUrls(ctx.request.body.panels);
  await ensureEpisodeReferences(ctx.request.body);
  const episode = await Episode.create({ ...ctx.request.body, status: EPISODE_STATUS.DRAFT });
  const populatedEpisode = await episode.populate('seriesId themeTagId');
  const counts = await getEpisodeCounts([episode._id]);
  ctx.ok({ episode: toPopulatedAdminEpisode(populatedEpisode, counts.get(String(episode._id))) });
}

export async function getAdminEpisode(ctx) {
  const episode = await findEpisodeOrFail(ctx.params.episodeId);
  const counts = await getEpisodeCounts([episode._id]);
  ctx.ok({ episode: toPopulatedAdminEpisode(episode, counts.get(String(episode._id))) });
}

export async function updateEpisode(ctx) {
  const episode = await findEpisodeOrFail(ctx.params.episodeId);

  if (episode.status === EPISODE_STATUS.PUBLISHED) {
    throw new ApiError(409, 'EPISODE_EDIT_REQUIRES_UNPUBLISH', '已发布单话必须先下架后再修改。');
  }

  if (ctx.request.body.panels) {
    ensureAllowedPanelUrls(ctx.request.body.panels);
  }
  await ensureEpisodeReferences(ctx.request.body);
  Object.assign(episode, ctx.request.body);
  await episode.save();
  const counts = await getEpisodeCounts([episode._id]);
  ctx.ok({ episode: toPopulatedAdminEpisode(episode, counts.get(String(episode._id))) });
}

export async function publishEpisode(ctx) {
  const episode = await findEpisodeOrFail(ctx.params.episodeId);

  if (!hasCompleteOrderedPanels(episode.panels)) {
    throw new ApiError(409, 'EPISODE_INCOMPLETE', '单话必须恰好包含 4 个有序画格才可发布。');
  }
  if (![EPISODE_STATUS.DRAFT, EPISODE_STATUS.UNPUBLISHED].includes(episode.status)) {
    throw new ApiError(409, 'INVALID_EPISODE_STATUS_TRANSITION', '当前单话状态不允许此操作。');
  }

  episode.status = EPISODE_STATUS.PUBLISHED;
  episode.publishedAt ||= new Date();
  await episode.save();
  ctx.ok({
    episode: {
      id: String(episode._id),
      status: episode.status,
      publishedAt: episode.publishedAt.toISOString(),
    },
  });
}

export async function unpublishEpisode(ctx) {
  const episode = await findEpisodeOrFail(ctx.params.episodeId);

  if (episode.status !== EPISODE_STATUS.PUBLISHED) {
    throw new ApiError(409, 'INVALID_EPISODE_STATUS_TRANSITION', '当前单话状态不允许此操作。');
  }

  episode.status = EPISODE_STATUS.UNPUBLISHED;
  await episode.save();
  ctx.ok({ episode: { id: String(episode._id), status: episode.status } });
}

export async function deleteEpisode(ctx) {
  const episode = await findEpisodeOrFail(ctx.params.episodeId);

  if (episode.status !== EPISODE_STATUS.DRAFT) {
    throw new ApiError(409, 'RESOURCE_DELETE_FORBIDDEN', '当前资源不满足删除条件。');
  }

  await episode.deleteOne();
  ctx.ok({ deleted: true });
}
