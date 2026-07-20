import { buildTimestampCursorFilter, createNextCursor } from '../content/pagination.js';
import { Episode } from '../models/episode.model.js';
import { ComicSeries } from '../models/series.model.js';
import { ApiError } from '../utils/api-error.js';

function toSeriesResponse(series, episodeCount = undefined) {
  const response = {
    id: String(series._id),
    name: series.name,
    summary: series.summary,
    authorByline: series.authorByline,
  };

  if (episodeCount !== undefined) {
    response.episodeCount = episodeCount;
  }

  return response;
}

export async function findSeriesOrFail(seriesId) {
  const series = await ComicSeries.findById(seriesId);

  if (!series) {
    throw new ApiError(404, 'RESOURCE_NOT_FOUND', '内容不存在或已不可用。');
  }

  return series;
}

export async function listAdminSeries(ctx) {
  const { cursor, limit } = ctx.state.query;
  const cursorFilter = buildTimestampCursorFilter({ cursor, field: 'createdAt' });

  if (cursor && !cursorFilter) {
    throw new ApiError(400, 'VALIDATION_ERROR', '请求参数不合法。');
  }

  const seriesList = await ComicSeries.find(cursorFilter || {})
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .lean();
  const items = seriesList.slice(0, limit);
  const counts = await Episode.aggregate([
    { $match: { seriesId: { $in: items.map(({ _id }) => _id) } } },
    { $group: { _id: '$seriesId', count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map(({ _id, count }) => [String(_id), count]));

  ctx.ok({
    items: items.map((series) => toSeriesResponse(series, countMap.get(String(series._id)) || 0)),
    nextCursor: seriesList.length > limit ? createNextCursor(items.at(-1), 'createdAt') : null,
  });
}

export async function createSeries(ctx) {
  const series = await ComicSeries.create(ctx.request.body);
  ctx.ok({ series: toSeriesResponse(series) });
}

export async function getAdminSeries(ctx) {
  const series = await findSeriesOrFail(ctx.params.seriesId);
  ctx.ok({ series: toSeriesResponse(series) });
}

export async function updateSeries(ctx) {
  const series = await findSeriesOrFail(ctx.params.seriesId);
  Object.assign(series, ctx.request.body);
  await series.save();
  ctx.ok({ series: toSeriesResponse(series) });
}

export async function deleteSeries(ctx) {
  const series = await findSeriesOrFail(ctx.params.seriesId);
  const hasEpisodes = await Episode.exists({ seriesId: series._id });

  if (hasEpisodes) {
    throw new ApiError(409, 'RESOURCE_DELETE_FORBIDDEN', '当前资源不满足删除条件。');
  }

  await series.deleteOne();
  ctx.ok({ deleted: true });
}
