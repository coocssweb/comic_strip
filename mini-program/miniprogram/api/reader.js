const { request } = require('../utils/request');
const { buildPublicApiPath } = require('../utils/discovery-view-model');

const readerApi = {
  /** @param {{code: string, profile?: {displayName: string, avatarUrl: string}}} payload 微信授权信息。 */
  wechatLogin(payload) {
    return request({ path: '/auth/wechat/login', method: 'POST', data: payload, showLoading: true });
  },

  /** @param {string} episodeId 单话 ID。 */
  createEpisodeLike(episodeId) {
    return request({ path: buildPublicApiPath(`/episodes/${episodeId}/likes`), method: 'POST', includeReaderSession: true });
  },

  /** @param {string} episodeId 单话 ID。 */
  deleteEpisodeLike(episodeId) {
    return request({ path: buildPublicApiPath(`/episodes/${episodeId}/likes`), method: 'DELETE', includeReaderSession: true });
  },

  /** @param {string} episodeId 单话 ID。 */
  createEpisodeFavorite(episodeId) {
    return request({ path: buildPublicApiPath(`/episodes/${episodeId}/favorites`), method: 'POST', includeReaderSession: true });
  },

  /** @param {string} episodeId 单话 ID。 */
  deleteEpisodeFavorite(episodeId) {
    return request({ path: buildPublicApiPath(`/episodes/${episodeId}/favorites`), method: 'DELETE', includeReaderSession: true });
  },

  /** @param {string} episodeId 单话 ID。 @param {string} content 评论内容。 */
  createComment(episodeId, content) {
    return request({ path: buildPublicApiPath(`/episodes/${episodeId}/comments`), method: 'POST', data: { content }, includeReaderSession: true });
  },

  /** @param {string} commentId 评论 ID。 */
  deleteComment(commentId) {
    return request({ path: buildPublicApiPath(`/comments/${commentId}`), method: 'DELETE', includeReaderSession: true });
  },

  /** @param {string} commentId 评论 ID。 */
  createCommentLike(commentId) {
    return request({ path: buildPublicApiPath(`/comments/${commentId}/likes`), method: 'POST', includeReaderSession: true });
  },

  /** @param {string} commentId 评论 ID。 */
  deleteCommentLike(commentId) {
    return request({ path: buildPublicApiPath(`/comments/${commentId}/likes`), method: 'DELETE', includeReaderSession: true });
  },

  /** @param {string} episodeId 单话 ID。 @param {{cursor?: string, limit?: number}} [options] 分页参数。 */
  listEpisodeComments(episodeId, { cursor, limit } = {}) {
    return request({ path: buildPublicApiPath(`/episodes/${episodeId}/comments`, { cursor, limit }), includeReaderSession: true });
  },

  /** @param {{cursor?: string, limit?: number}} [options] 分页参数。 */
  listMyFavorites({ cursor, limit } = {}) {
    return request({ path: buildPublicApiPath('/me/favorites', { cursor, limit }), includeReaderSession: true });
  },

  /** @param {{cursor?: string, limit?: number}} [options] 分页参数。 */
  listMyEpisodeLikes({ cursor, limit } = {}) {
    return request({ path: buildPublicApiPath('/me/episode-likes', { cursor, limit }), includeReaderSession: true });
  },

  /** @param {{cursor?: string, limit?: number}} [options] 分页参数。 */
  listMyComments({ cursor, limit } = {}) {
    return request({ path: buildPublicApiPath('/me/comments', { cursor, limit }), includeReaderSession: true });
  },
};

module.exports = {
  readerApi,
};
