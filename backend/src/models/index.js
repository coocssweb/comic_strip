import { CommentLike } from './comment-like.model.js';
import { Comment, LEGACY_ACTIVE_COMMENT_INDEX } from './comment.model.js';
import { EpisodeFavorite } from './episode-favorite.model.js';
import { EpisodeLike } from './episode-like.model.js';
import { EpisodeShare } from './episode-share.model.js';
import { Episode } from './episode.model.js';
import { Reader } from './reader.model.js';
import { ComicSeries } from './series.model.js';
import { Session } from './session.model.js';
import { Tag } from './tag.model.js';
import { Topic } from './topic.model.js';
import { User } from './user.model.js';

export const REGISTERED_MODELS = [
  CommentLike,
  Comment,
  EpisodeFavorite,
  EpisodeLike,
  EpisodeShare,
  Episode,
  Reader,
  ComicSeries,
  Session,
  Tag,
  Topic,
  User,
];

/**
 * 旧索引与新的已删除视图索引键序相同，会触发 MongoDB 的 IndexOptionsConflict；只能在新索引创建成功后由受控迁移入口删除。
 * @returns {Promise<void>} 遗留索引删除完成。
 */
async function removeLegacyActiveCommentIndex() {
  try {
    await Comment.collection.dropIndex(LEGACY_ACTIVE_COMMENT_INDEX);
  } catch (error) {
    if (error?.code !== 27) {
      throw error;
    }
  }
}

/**
 * 显式补建所有已注册模型索引，并在成功后迁移旧的有效评论索引；此函数仅由受控索引脚本调用。
 * @returns {Promise<void>} 全部索引迁移完成。
 */
export async function ensureRegisteredModelIndexes() {
  await Promise.all(REGISTERED_MODELS.map((model) => model.createIndexes()));
  await removeLegacyActiveCommentIndex();
}
