import { buildTimestampCursorFilter, createNextCursor } from '../content/pagination.js';
import { env } from '../config/env.js';
import { isAllowedCosPublicUrl } from '../cos/cos-upload.js';
import { Episode } from '../models/episode.model.js';
import { Topic } from '../models/topic.model.js';
import { ApiError } from '../utils/api-error.js';

function toTopicResponse(topic, episodeCount = undefined) {
  const response = {
    id: String(topic._id),
    title: topic.title,
    summary: topic.summary,
    coverImageUrl: topic.coverImageUrl,
  };

  if (episodeCount !== undefined) {
    response.episodeCount = episodeCount;
  }

  return response;
}

async function findTopicOrFail(topicId) {
  const topic = await Topic.findById(topicId);

  if (!topic) {
    throw new ApiError(404, 'RESOURCE_NOT_FOUND', '内容不存在或已不可用。');
  }

  return topic;
}

async function validateTopicPayload(payload) {
  if (
    payload.coverImageUrl &&
    !isAllowedCosPublicUrl(payload.coverImageUrl, env.cosPublicBaseUrl)
  ) {
    throw new ApiError(422, 'INVALID_COS_PUBLIC_URL', '图片地址不是允许的 COS 公网 HTTPS 地址。');
  }

  if (payload.episodeIds) {
    const publishedCount = await Episode.countDocuments({
      _id: { $in: payload.episodeIds },
      status: 'published',
    });

    if (publishedCount !== payload.episodeIds.length) {
      throw new ApiError(400, 'VALIDATION_ERROR', '请求参数不合法。');
    }
  }
}

export async function listAdminTopics(ctx) {
  const { cursor, limit } = ctx.state.query;
  const cursorFilter = buildTimestampCursorFilter({ cursor, field: 'createdAt' });

  if (cursor && !cursorFilter) {
    throw new ApiError(400, 'VALIDATION_ERROR', '请求参数不合法。');
  }

  const topics = await Topic.find(cursorFilter || {})
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .lean();
  const items = topics.slice(0, limit);

  ctx.ok({
    items: items.map((topic) => toTopicResponse(topic, topic.episodeIds.length)),
    nextCursor: topics.length > limit ? createNextCursor(items.at(-1), 'createdAt') : null,
  });
}

export async function createTopic(ctx) {
  await validateTopicPayload(ctx.request.body);
  const topic = await Topic.create(ctx.request.body);
  ctx.ok({ topic: { ...toTopicResponse(topic), episodeIds: topic.episodeIds.map(String) } });
}

export async function getAdminTopic(ctx) {
  const topic = await findTopicOrFail(ctx.params.topicId);
  ctx.ok({ topic: { ...toTopicResponse(topic), episodeIds: topic.episodeIds.map(String) } });
}

export async function updateTopic(ctx) {
  const topic = await findTopicOrFail(ctx.params.topicId);
  await validateTopicPayload(ctx.request.body);
  Object.assign(topic, ctx.request.body);
  await topic.save();
  ctx.ok({ topic: { ...toTopicResponse(topic), episodeIds: topic.episodeIds.map(String) } });
}

export async function deleteTopic(ctx) {
  const topic = await findTopicOrFail(ctx.params.topicId);
  await topic.deleteOne();
  ctx.ok({ deleted: true });
}
