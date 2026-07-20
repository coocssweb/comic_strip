const { discoveryApi } = require('../../api/discovery');
const { mergeEpisodeCards, toEpisodeCard, toSeriesCard } = require('../../utils/discovery-view-model');

Page({
  data: {
    seriesId: '',
    series: null,
    episodes: [],
    nextCursor: null,
    isLoadingMore: false,
    isUnavailable: false,
  },

  onLoad(options) {
    if (!options.seriesId) {
      this.setData({ isUnavailable: true });
      return;
    }

    this.setData({ seriesId: options.seriesId });
    this.loadSeries({ reset: true });
  },

  onReachBottom() {
    if (this.data.nextCursor && !this.data.isLoadingMore) {
      this.loadSeries({ reset: false });
    }
  },

  async loadSeries({ reset }) {
    if (!reset) {
      this.setData({ isLoadingMore: true });
    }

    try {
      const result = await discoveryApi.getSeries(this.data.seriesId, {
        cursor: reset ? undefined : this.data.nextCursor,
        limit: 20,
        showLoading: reset,
      });
      const nextEpisodes = (result.episodes || []).map(toEpisodeCard);

      this.setData({
        series: toSeriesCard(result.series),
        episodes: reset ? nextEpisodes : mergeEpisodeCards(this.data.episodes, nextEpisodes),
        nextCursor: result.nextCursor || null,
      });
    } catch (error) {
      this.setData({ isUnavailable: true });
      wx.showToast({ title: error.message || '系列内容加载失败，请稍后重试。', icon: 'none' });
    } finally {
      this.setData({ isLoadingMore: false });
    }
  },

  handleOpenEpisode(event) {
    const { episodeId } = event.detail;
    wx.navigateTo({ url: `/packageReader/reader/reader?episodeId=${encodeURIComponent(episodeId)}` });
  },
});
