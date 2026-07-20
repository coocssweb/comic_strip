import { Episode } from '../models/episode.model.js';
import { Tag } from '../models/tag.model.js';
import { ApiError } from '../utils/api-error.js';

function toTagResponse(tag) {
  return { id: String(tag._id), name: tag.name, sortOrder: tag.sortOrder };
}

async function findTagOrFail(tagId) {
  const tag = await Tag.findById(tagId);

  if (!tag) {
    throw new ApiError(404, 'RESOURCE_NOT_FOUND', '内容不存在或已不可用。');
  }

  return tag;
}

export async function listTags(ctx) {
  const tags = await Tag.find().sort({ sortOrder: 1, _id: 1 }).lean();
  ctx.ok({ items: tags.map(toTagResponse) });
}

export async function createTag(ctx) {
  const tag = await Tag.create(ctx.request.body);
  ctx.ok({ tag: toTagResponse(tag) });
}

export async function updateTag(ctx) {
  const tag = await findTagOrFail(ctx.params.tagId);
  Object.assign(tag, ctx.request.body);
  await tag.save();
  ctx.ok({ tag: toTagResponse(tag) });
}

export async function deleteTag(ctx) {
  const tag = await findTagOrFail(ctx.params.tagId);
  const isInUse = await Episode.exists({ themeTagId: tag._id });

  if (isInUse) {
    throw new ApiError(409, 'TAG_IN_USE', '标签已被单话使用，无法删除。');
  }

  await tag.deleteOne();
  ctx.ok({ deleted: true });
}
