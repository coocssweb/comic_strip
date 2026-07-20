const { discoveryApi } = require('../../api/discovery');
const { mergeEpisodeCards, toEpisodeCard } = require('../../utils/discovery-view-model');

Page({
  data: {
    episodes: [],
    nextCursor: null,
    isLoading: false,
    isLoadingMore: false,
    hasLoaded: false,
  },

  onLoad() {
    this.loadEpisodes({ reset: true });
  },

  onPullDownRefresh() {
    this.loadEpisodes({ reset: true }).finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom() {
    if (this.data.nextCursor && !this.data.isLoadingMore) {
      this.loadEpisodes({ reset: false });
    }
  },

  async loadEpisodes({ reset }) {
    if (reset) {
      this.setData({ isLoading: true, hasLoaded: false });
    } else {
      this.setData({ isLoadingMore: true });
    }

    try {
      const page = await discoveryApi.listEpisodes({
        cursor: reset ? undefined : this.data.nextCursor,
        limit: 20,
        showLoading: reset,
      });
      const nextEpisodes = (page.items || []).map(toEpisodeCard);

      this.setData({
        episodes: reset ? nextEpisodes : mergeEpisodeCards(this.data.episodes, nextEpisodes),
        nextCursor: page.nextCursor || null,
        hasLoaded: true,
      });
    } catch (error) {
      wx.showToast({ title: error.message || '内容加载失败，请稍后重试。', icon: 'none' });
    } finally {
      this.setData({ isLoading: false, isLoadingMore: false });
    }
  },

  handleOpenEpisode(event) {
    const { episodeId } = event.detail;
    wx.navigateTo({ url: `/packageReader/reader/reader?episodeId=${encodeURIComponent(episodeId)}` });
  },

  handleOpenDiscover() {
    wx.navigateTo({ url: '/packageDiscover/discover/discover' });
  },

  handleOpenProfile() {
    wx.navigateTo({ url: '/packageUser/profile/profile' });
  },
});
