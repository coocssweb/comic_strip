function toCount(value) {
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

/**
 * 将后端评论转换为阅读器和“我的评论”共用的视图模型，避免模板依赖嵌套响应结构。
 *
 * @param {object} comment 后端评论。
 * @returns {object} 评论视图模型。
 */
function toCommentItem(comment) {
  const author = comment.author || {};
  const viewerState = comment.viewerState || {};

  return {
    id: comment.id || '',
    episodeId: comment.episodeId || '',
    content: comment.content || '',
    createdAt: comment.createdAt || '',
    authorName: author.displayName || '读者',
    authorAvatarUrl: author.avatarUrl || '',
    likeCount: toCount(comment.likeCount),
    isLiked: Boolean(viewerState.isLiked),
    canDelete: Boolean(viewerState.canDelete),
  };
}

/**
 * 合并游标分页数据，避免内容变动造成重复展示。
 *
 * @param {Array<object>} currentItems 已加载条目。
 * @param {Array<object>} nextItems 下一页条目。
 * @returns {Array<object>} 去重后的条目。
 */
function mergeReaderItems(currentItems, nextItems) {
  const knownIds = new Set((Array.isArray(currentItems) ? currentItems : []).map((item) => item.id));
  const uniqueItems = (Array.isArray(nextItems) ? nextItems : []).filter((item) => {
    if (!item.id || knownIds.has(item.id)) {
      return false;
    }

    knownIds.add(item.id);
    return true;
  });

  return [...(Array.isArray(currentItems) ? currentItems : []), ...uniqueItems];
}

module.exports = {
  mergeReaderItems,
  toCommentItem,
};
