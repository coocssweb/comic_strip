const { discoveryApi } = require('../../api/discovery');
const { toEpisodeCard, toTopicCard } = require('../../utils/discovery-view-model');

Page({
  data: {
    topic: null,
    episodes: [],
    isUnavailable: false,
  },

  onLoad(options) {
    if (!options.topicId) {
      this.setData({ isUnavailable: true });
      return;
    }

    this.loadTopic(options.topicId);
  },

  async loadTopic(topicId) {
    try {
      const result = await discoveryApi.getTopic(topicId, { showLoading: true });
      this.setData({
        topic: toTopicCard(result.topic),
        episodes: (result.episodes || []).map(toEpisodeCard),
      });
    } catch (error) {
      this.setData({ isUnavailable: true });
      wx.showToast({ title: error.message || '专题内容加载失败，请稍后重试。', icon: 'none' });
    }
  },

  handleOpenEpisode(event) {
    const { episodeId } = event.detail;
    wx.navigateTo({ url: `/packageReader/reader/reader?episodeId=${encodeURIComponent(episodeId)}` });
  },
});
