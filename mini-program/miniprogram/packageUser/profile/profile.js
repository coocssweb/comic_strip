const { createStoreBindings } = require('mobx-miniprogram-bindings');
const { readerApi } = require('../../api/reader');
const { readerStore } = require('../../stores/reader');
const { loginReader } = require('../../utils/reader-auth');
const { mergeReaderItems, toCommentItem } = require('../../utils/reader-view-model');
const { mergeEpisodeCards, toEpisodeCard } = require('../../utils/discovery-view-model');

const PAGE_SIZE = 20;

const profileSections = {
  favorites: {
    load: readerApi.listMyFavorites,
    mapItems: (items) => items.map(toEpisodeCard),
    merge: mergeEpisodeCards,
  },
  likes: {
    load: readerApi.listMyEpisodeLikes,
    mapItems: (items) => items.map(toEpisodeCard),
    merge: mergeEpisodeCards,
  },
  comments: {
    load: readerApi.listMyComments,
    mapItems: (items) => items.map(toCommentItem),
    merge: mergeReaderItems,
  },
};

Page({
  data: {
    reader: null,
    isLoggedIn: false,
    activeSection: 'favorites',
    items: [],
    nextCursor: null,
    isLoading: false,
    isLoadingMore: false,
    hasLoaded: false,
  },

  onLoad() {
    this.isPageActive = true;
    this.storeBindings = createStoreBindings(this, {
      store: readerStore,
      fields: ['reader', 'isLoggedIn'],
    });
  },

  onShow() {
    if (readerStore.hasActiveSession()) {
      this.loadActiveSection({ reset: true });
    }
  },

  onUnload() {
    this.isPageActive = false;
    this.storeBindings.destroyStoreBindings();
  },

  onReachBottom() {
    if (this.data.nextCursor && !this.data.isLoadingMore) {
      this.loadActiveSection({ reset: false });
    }
  },

  async handleLogin() {
    try {
      await loginReader();
      await this.loadActiveSection({ reset: true });
    } catch (error) {
      wx.showToast({ title: error.message || '微信登录失败，请稍后重试。', icon: 'none' });
    }
  },

  handleSelectSection(event) {
    const { section } = event.currentTarget.dataset;
    if (!profileSections[section] || section === this.data.activeSection) {
      return;
    }

    this.setData({ activeSection: section, items: [], nextCursor: null, hasLoaded: false });
    this.loadActiveSection({ reset: true });
  },

  async loadActiveSection({ reset }) {
    if (!readerStore.hasActiveSession()) {
      this.setData({ items: [], nextCursor: null, hasLoaded: false });
      return;
    }

    const sectionName = this.data.activeSection;
    const section = profileSections[sectionName];
    if (reset) {
      this.setData({ isLoading: true, hasLoaded: false });
    } else {
      this.setData({ isLoadingMore: true });
    }

    try {
      const page = await section.load({
        cursor: reset ? undefined : this.data.nextCursor,
        limit: PAGE_SIZE,
      });
      const nextItems = section.mapItems(page.items || []);
      if (!this.isPageActive || this.data.activeSection !== sectionName) {
        return;
      }

      this.setData({
        items: reset ? nextItems : section.merge(this.data.items, nextItems),
        nextCursor: page.nextCursor || null,
        hasLoaded: true,
      });
    } catch (error) {
      this.handleReaderRequestError(error);
    } finally {
      if (this.isPageActive) {
        this.setData({ isLoading: false, isLoadingMore: false });
      }
    }
  },

  handleOpenEpisode(event) {
    const { episodeId } = event.detail;
    wx.navigateTo({ url: `/packageReader/reader/reader?episodeId=${encodeURIComponent(episodeId)}` });
  },

  handleOpenCommentEpisode(event) {
    const { episodeId } = event.currentTarget.dataset;
    if (episodeId) {
      wx.navigateTo({ url: `/packageReader/reader/reader?episodeId=${encodeURIComponent(episodeId)}` });
    }
  },

  handleReaderRequestError(error) {
    if (error.code === 'READER_AUTH_REQUIRED') {
      readerStore.clearSession();
      this.setData({ items: [], nextCursor: null, hasLoaded: false });
    }

    wx.showToast({ title: error.message || '加载失败，请稍后重试。', icon: 'none' });
  },
});
