const { request } = require('../utils/request');
const { buildPublicApiPath } = require('../utils/discovery-view-model');

const discoveryApi = {
  /** @param {{cursor?: string, limit?: number, showLoading?: boolean}} [options] @returns {Promise<object>} */
  listEpisodes({ cursor, limit, showLoading = false } = {}) {
    return request({
      path: buildPublicApiPath('/episodes', { cursor, limit }),
      showLoading,
    });
  },

  /** @param {string} episodeId 单话 ID。 @param {{showLoading?: boolean, includeReaderSession?: boolean}} [options] @returns {Promise<object>} */
  getEpisode(episodeId, { showLoading = false, includeReaderSession = false } = {}) {
    return request({
      path: buildPublicApiPath(`/episodes/${episodeId}`),
      showLoading,
      includeReaderSession,
    });
  },

  /** @param {{cursor?: string, limit?: number, showLoading?: boolean}} [options] @returns {Promise<object>} */
  listSeries({ cursor, limit, showLoading = false } = {}) {
    return request({
      path: buildPublicApiPath('/series', { cursor, limit }),
      showLoading,
    });
  },

  /** @param {string} seriesId 系列 ID。 @param {{cursor?: string, limit?: number, showLoading?: boolean}} [options] @returns {Promise<object>} */
  getSeries(seriesId, { cursor, limit, showLoading = false } = {}) {
    return request({
      path: buildPublicApiPath(`/series/${seriesId}`, { cursor, limit }),
      showLoading,
    });
  },

  /** @param {{cursor?: string, limit?: number, showLoading?: boolean}} [options] @returns {Promise<object>} */
  listTopics({ cursor, limit, showLoading = false } = {}) {
    return request({
      path: buildPublicApiPath('/topics', { cursor, limit }),
      showLoading,
    });
  },

  /** @param {string} topicId 专题 ID。 @param {{showLoading?: boolean}} [options] @returns {Promise<object>} */
  getTopic(topicId, { showLoading = false } = {}) {
    return request({
      path: buildPublicApiPath(`/topics/${topicId}`),
      showLoading,
    });
  },

  /** @param {{month?: string, showLoading?: boolean}} [options] @returns {Promise<object>} */
  getMonthlyRanking({ month, showLoading = false } = {}) {
    return request({
      path: buildPublicApiPath('/rankings/monthly-series', { month }),
      showLoading,
    });
  },

  /** @param {string} episodeId 单话 ID。 @returns {Promise<object>} */
  recordEpisodeShare(episodeId) {
    return request({
      path: buildPublicApiPath(`/episodes/${episodeId}/shares`),
      method: 'POST',
    });
  },
};

module.exports = {
  discoveryApi,
};
