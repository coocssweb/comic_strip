/**
 * 构造公开内容接口路径，避免资源标识或游标破坏 URL。
 *
 * @param {string} path 未编码的接口路径。
 * @param {Record<string, string | number | null | undefined>} [query] 查询参数。
 * @returns {string} 已编码的接口相对路径。
 */
function buildPublicApiPath(path, query) {
  const encodedPath = path
    .split('/')
    .map((segment) => (segment ? encodeURIComponent(segment) : ''))
    .join('/');
  const queryEntries = Object.entries(query || {}).filter(([, value]) => value !== null && value !== undefined && value !== '');

  if (queryEntries.length === 0) {
    return encodedPath;
  }

  const queryString = queryEntries
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');

  return `${encodedPath}?${queryString}`;
}

function toCount(value) {
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

/**
 * 将接口 `panels` 按 `position` 映射为阅读器的有序画格。
 *
 * @param {Array<{position: number, imageUrl: string, altText?: string | null}>} panels 后端四格画面。
 * @returns {Array<{position: number, imageUrl: string, altText: string}>} 有序画格。
 */
function sortPanels(panels) {
  return (Array.isArray(panels) ? panels : [])
    .map((panel) => ({
      position: panel.position,
      imageUrl: panel.imageUrl,
      altText: panel.altText || '',
    }))
    .sort((left, right) => left.position - right.position);
}

/**
 * 将 API `EpisodeSummary` 的系列、标签和互动计数字段映射为列表视图模型。
 *
 * @param {object} episode 后端返回的公开单话摘要。
 * @returns {object} 首页、系列页和专题页共用的单话卡片数据。
 */
function toEpisodeCard(episode) {
  const counts = episode.counts || {};
  const series = episode.series || {};
  const themeTag = episode.themeTag || {};

  return {
    id: episode.id,
    title: episode.title || '',
    seriesId: series.id || '',
    seriesName: series.name || '',
    themeTagName: themeTag.name || '',
    thumbnailUrl: episode.thumbnailUrl || '',
    publishedAt: episode.publishedAt || '',
    likeCount: toCount(counts.likeCount),
    favoriteCount: toCount(counts.favoriteCount),
    commentCount: toCount(counts.commentCount),
    shareCount: toCount(counts.shareCount),
  };
}

/**
 * 合并游标分页结果，避免边界数据变化时重复展示同一单话。
 *
 * @param {Array<object>} currentEpisodes 已加载单话。
 * @param {Array<object>} nextEpisodes 下一页单话。
 * @returns {Array<object>} 按原顺序去重后的单话。
 */
function mergeEpisodeCards(currentEpisodes, nextEpisodes) {
  const existingEpisodes = Array.isArray(currentEpisodes) ? currentEpisodes : [];
  const knownEpisodeIds = new Set(existingEpisodes.map((episode) => episode.id));
  const uniqueNextEpisodes = (Array.isArray(nextEpisodes) ? nextEpisodes : []).filter((episode) => {
    if (!episode.id || knownEpisodeIds.has(episode.id)) {
      return false;
    }

    knownEpisodeIds.add(episode.id);
    return true;
  });

  return [...existingEpisodes, ...uniqueNextEpisodes];
}

/**
 * 判断发现页是否至少有一个公开内容分区。
 *
 * @param {{series: Array<object>, topics: Array<object>, ranking: Array<object>}} sections 发现页分区数据。
 * @returns {boolean} 是否存在可展示内容。
 */
function hasDiscoverContent({ series, topics, ranking }) {
  return [series, topics, ranking].some((section) => Array.isArray(section) && section.length > 0);
}

/**
 * 将 API `EpisodeDetail` 映射为阅读器数据，并保留后端给定的相邻单话流向。
 *
 * @param {object} episode 后端返回的公开单话详情。
 * @returns {object} 阅读器视图模型。
 */
function toReaderEpisode(episode) {
  return {
    ...toEpisodeCard(episode),
    summary: episode.summary || '',
    panels: sortPanels(episode.panels),
    previousEpisodeId: episode.readerFlow?.previousEpisodeId || '',
    nextEpisodeId: episode.readerFlow?.nextEpisodeId || '',
  };
}

/**
 * 将 API 系列对象映射为发现页和系列页使用的视图字段。
 *
 * @param {object} series 后端返回的公开系列。
 * @returns {object} 系列视图模型。
 */
function toSeriesCard(series) {
  return {
    id: series.id,
    name: series.name || '',
    summary: series.summary || '',
    authorByline: series.authorByline || '',
    thumbnailUrl: series.thumbnailUrl || '',
  };
}

/**
 * 将 API 专题对象映射为发现页和专题页使用的视图字段。
 *
 * @param {object} topic 后端返回的公开专题。
 * @returns {object} 专题视图模型。
 */
function toTopicCard(topic) {
  return {
    id: topic.id,
    title: topic.title || '',
    summary: topic.summary || '',
    coverImageUrl: topic.coverImageUrl || '',
  };
}

/**
 * 将 API 月榜对象映射为发现页排行榜字段。
 *
 * @param {object} row 后端返回的月榜条目。
 * @returns {object} 月榜视图模型。
 */
function toRankingRow(row) {
  const series = row.series || {};

  return {
    rank: toCount(row.rank),
    seriesId: series.id || '',
    seriesName: series.name || '',
    authorByline: series.authorByline || '',
    heat: toCount(row.heat),
    shareCount: toCount(row.shareCount),
  };
}

module.exports = {
  buildPublicApiPath,
  sortPanels,
  toEpisodeCard,
  mergeEpisodeCards,
  hasDiscoverContent,
  toReaderEpisode,
  toSeriesCard,
  toTopicCard,
  toRankingRow,
};
