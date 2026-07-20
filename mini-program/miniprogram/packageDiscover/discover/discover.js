const { discoveryApi } = require('../../api/discovery');
const {
  hasDiscoverContent,
  toRankingRow,
  toSeriesCard,
  toTopicCard,
} = require('../../utils/discovery-view-model');

Page({
  data: {
    series: [],
    topics: [],
    ranking: [],
    month: '',
    seriesNextCursor: null,
    topicsNextCursor: null,
    hasLoaded: false,
    hasContent: false,
    isLoadingMore: false,
  },

  onLoad() {
    this.loadDiscovery();
  },

  onReachBottom() {
    if ((this.data.seriesNextCursor || this.data.topicsNextCursor) && !this.data.isLoadingMore) {
      this.loadDiscovery({ append: true });
    }
  },

  async loadDiscovery({ append = false } = {}) {
    if (append) {
      this.setData({ isLoadingMore: true });
    }

    try {
      const [seriesPage, topicsPage, rankingResult] = await Promise.all([
        append && !this.data.seriesNextCursor
          ? Promise.resolve({ items: [], nextCursor: null })
          : discoveryApi.listSeries({
            cursor: append ? this.data.seriesNextCursor : undefined,
            limit: 10,
            showLoading: !append,
          }),
        append && !this.data.topicsNextCursor
          ? Promise.resolve({ items: [], nextCursor: null })
          : discoveryApi.listTopics({
            cursor: append ? this.data.topicsNextCursor : undefined,
            limit: 10,
          }),
        append ? Promise.resolve(null) : discoveryApi.getMonthlyRanking(),
      ]);
      const nextSeries = (seriesPage.items || []).map(toSeriesCard);
      const nextTopics = (topicsPage.items || []).map(toTopicCard);
      const series = append ? [...this.data.series, ...nextSeries] : nextSeries;
      const topics = append ? [...this.data.topics, ...nextTopics] : nextTopics;
      const ranking = append ? this.data.ranking : (rankingResult.items || []).map(toRankingRow);

      this.setData({
        series,
        topics,
        ranking,
        month: append ? this.data.month : rankingResult.month || '',
        seriesNextCursor: seriesPage.nextCursor || null,
        topicsNextCursor: topicsPage.nextCursor || null,
        hasLoaded: true,
        hasContent: hasDiscoverContent({ series, topics, ranking }),
      });
    } catch (error) {
      this.setData({ hasLoaded: true });
      wx.showToast({ title: error.message || '发现内容加载失败，请稍后重试。', icon: 'none' });
    } finally {
      this.setData({ isLoadingMore: false });
    }
  },

  handleOpenSeries(event) {
    const { seriesId } = event.currentTarget.dataset;
    wx.navigateTo({ url: `/packageDiscover/series/series?seriesId=${encodeURIComponent(seriesId)}` });
  },

  handleOpenTopic(event) {
    const { topicId } = event.currentTarget.dataset;
    wx.navigateTo({ url: `/packageDiscover/topic/topic?topicId=${encodeURIComponent(topicId)}` });
  },
});
