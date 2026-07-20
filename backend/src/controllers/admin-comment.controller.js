import { buildTimestampCursorFilter, createNextCursor } from '../content/pagination.js';
import { Comment } from '../models/comment.model.js';
import { ApiError } from '../utils/api-error.js';

function getReferenceId(reference) {
  return reference ? String(reference._id || reference) : null;
}

/**
 * 关联记录被物理清理时，Mongoose 会传入空文档；此时必须保留原引用 ID 以满足审计追溯。
 * @param {object | null} document 已关联的记录。
 * @param {unknown} referenceId 关联字段原始值。
 * @returns {object | unknown} 已关联记录或原始引用 ID。
 */
function preserveReferenceId(document, referenceId) {
  return document || referenceId;
}

/**
 * 将关联后的评论数据转换为管理端契约，已删除评论保留审计信息供追溯。
 * @param {object} comment 关联读者与单话后的评论记录。
 * @returns {object} 管理端评论视图模型。
 */
export function toAdminComment(comment) {
  return {
    id: String(comment._id),
    content: comment.content,
    createdAt: comment.createdAt.toISOString(),
    author: {
      id: getReferenceId(comment.readerId),
      displayName: comment.readerId?.displayName || null,
      avatarUrl: comment.readerId?.avatarUrl || null,
    },
    episode: {
      id: getReferenceId(comment.episodeId),
      title: comment.episodeId?.title || null,
      status: comment.episodeId?.status || null,
    },
    audit: comment.deletedAt
      ? {
          deletedAt: comment.deletedAt.toISOString(),
          deletedBy: {
            role: comment.deletedByRole,
            id: String(comment.deletedById),
          },
        }
      : null,
  };
}

/**
 * 分页查询有效或已删除评论，游标固定按创建时间排序以保持翻页稳定。
 * @param {import('koa').Context} ctx Koa 请求上下文。
 * @returns {Promise<void>} 通过统一响应写入评论分页数据。
 */
export async function listAdminComments(ctx) {
  const { cursor, limit, view } = ctx.state.query;
  const cursorFilter = buildTimestampCursorFilter({ cursor, field: 'createdAt' });

  if (cursor && !cursorFilter) {
    throw new ApiError(400, 'VALIDATION_ERROR', '请求参数不合法。');
  }

  const commentList = await Comment.find({
    ...(cursorFilter || {}),
    deletedAt: view === 'deleted' ? { $type: 'date' } : null,
  })
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .populate({ path: 'readerId', transform: preserveReferenceId })
    .populate({ path: 'episodeId', transform: preserveReferenceId })
    .lean();
  const items = commentList.slice(0, limit);

  ctx.ok({
    items: items.map(toAdminComment),
    nextCursor: commentList.length > limit ? createNextCursor(items.at(-1), 'createdAt') : null,
  });
}

/**
 * 管理员软删除评论；条件更新确保并发重复删除不会覆盖首次审计记录。
 * @param {import('koa').Context} ctx Koa 请求上下文。
 * @returns {Promise<void>} 通过统一响应写入删除结果。
 */
export async function deleteAdminComment(ctx) {
  const { commentId } = ctx.params;
  const comment = await Comment.findOneAndUpdate(
    { _id: commentId, deletedAt: null },
    {
      $set: {
        deletedAt: new Date(),
        deletedByRole: 'admin',
        deletedById: ctx.state.auth.subjectId,
      },
    },
    { new: true },
  );

  if (comment) {
    ctx.ok({ deleted: true });
    return;
  }

  if (await Comment.exists({ _id: commentId })) {
    throw new ApiError(409, 'COMMENT_ALREADY_DELETED', '评论已删除。');
  }

  throw new ApiError(404, 'RESOURCE_NOT_FOUND', '评论不存在。');
}
