const { discoveryApi } = require('../../api/discovery');
const { readerApi } = require('../../api/reader');
const { readerStore } = require('../../stores/reader');
const { loginReader } = require('../../utils/reader-auth');
const { mergeReaderItems, toCommentItem } = require('../../utils/reader-view-model');
const { toReaderEpisode } = require('../../utils/discovery-view-model');

const COMMENT_PAGE_SIZE = 20;

function createPlaceholder() {
  return { id: '', isAvailable: false, panels: [] };
}

function toInteractiveReaderEpisode(episode) {
  const viewerState = episode.viewerState || {};

  return {
    ...toReaderEpisode(episode),
    isLiked: Boolean(viewerState.isLiked),
    isFavorited: Boolean(viewerState.isFavorited),
  };
}

Page({
  data: {
    activeEpisodeId: '',
    episodeSlides: [createPlaceholder(), createPlaceholder(), createPlaceholder()],
    readerIndex: 1,
    isUnavailable: false,
    comments: [],
    commentsNextCursor: null,
    commentContent: '',
    isCommentsLoading: false,
    isSubmittingComment: false,
  },

  onLoad(options) {
    this.isPageActive = true;
    if (!options.episodeId) {
      this.setData({ isUnavailable: true });
      return;
    }

    this.loadEpisode(options.episodeId);
  },

  onUnload() {
    this.isPageActive = false;
  },

  async loadEpisode(episodeId) {
    try {
      const detail = await discoveryApi.getEpisode(episodeId, { showLoading: true, includeReaderSession: true });
      if (!this.isPageActive) {
        return;
      }
      const currentEpisode = { ...toInteractiveReaderEpisode(detail), isAvailable: true };

      this.setData({
        activeEpisodeId: currentEpisode.id,
        episodeSlides: [createPlaceholder(), currentEpisode, createPlaceholder()],
        readerIndex: 1,
        isUnavailable: false,
      });

      const adjacentEpisodes = await Promise.all([
        this.loadAdjacentEpisode(currentEpisode.previousEpisodeId),
        this.loadAdjacentEpisode(currentEpisode.nextEpisodeId),
      ]);

      if (this.isPageActive && this.data.activeEpisodeId === currentEpisode.id) {
        this.setData({
          episodeSlides: [adjacentEpisodes[0], currentEpisode, adjacentEpisodes[1]],
        });
      }

      this.loadComments({ reset: true, episodeId: currentEpisode.id });
    } catch {
      if (this.isPageActive) {
        this.setData({ isUnavailable: true });
      }
    }
  },

  async loadAdjacentEpisode(episodeId) {
    if (!episodeId) {
      return createPlaceholder();
    }

    try {
      const detail = await discoveryApi.getEpisode(episodeId);
      return { ...toInteractiveReaderEpisode(detail), isAvailable: true };
    } catch (error) {
      console.warn('相邻单话加载失败', { episodeId, error });
      return createPlaceholder();
    }
  },

  handleVerticalChange(event) {
    const nextIndex = event.detail.current;
    const nextEpisode = this.data.episodeSlides[nextIndex];
    const nextEpisodeId = nextIndex === 1 ? '' : nextEpisode?.id || '';

    if (!nextEpisodeId || !nextEpisode.isAvailable) {
      this.setData({ readerIndex: 1 });
      return;
    }

    wx.redirectTo({
      url: `/packageReader/reader/reader?episodeId=${encodeURIComponent(nextEpisodeId)}`,
    });
  },

  handleOpenSeries(event) {
    const { seriesId } = event.currentTarget.dataset;
    wx.navigateTo({ url: `/packageDiscover/series/series?seriesId=${encodeURIComponent(seriesId)}` });
  },

  async loadComments({ reset, episodeId = this.data.activeEpisodeId }) {
    if (!this.isPageActive || !episodeId || (!reset && (!this.data.commentsNextCursor || this.data.isCommentsLoading))) {
      return;
    }

    this.setData({ isCommentsLoading: true });
    try {
      const page = await readerApi.listEpisodeComments(episodeId, {
        cursor: reset ? undefined : this.data.commentsNextCursor,
        limit: COMMENT_PAGE_SIZE,
      });

      if (!this.isPageActive || this.data.activeEpisodeId !== episodeId) {
        return;
      }

      const nextComments = (page.items || []).map(toCommentItem);
      this.setData({
        comments: reset ? nextComments : mergeReaderItems(this.data.comments, nextComments),
        commentsNextCursor: page.nextCursor || null,
      });
    } catch (error) {
      this.handleReaderRequestError(error, '评论加载失败，请稍后重试。');
    } finally {
      if (this.isPageActive && this.data.activeEpisodeId === episodeId) {
        this.setData({ isCommentsLoading: false });
      }
    }
  },

  handleLoadMoreComments() {
    this.loadComments({ reset: false });
  },

  handleCommentInput(event) {
    this.setData({ commentContent: event.detail.value });
  },

  async handleToggleEpisodeLike() {
    const activeEpisode = this.data.episodeSlides[1];
    if (!activeEpisode?.id || !(await this.ensureLoggedIn())) {
      return;
    }

    try {
      const result = activeEpisode.isLiked
        ? await readerApi.deleteEpisodeLike(activeEpisode.id)
        : await readerApi.createEpisodeLike(activeEpisode.id);
      if (!this.isPageActive) {
        return;
      }

      this.setData({
        'episodeSlides[1].isLiked': result.isLiked,
        'episodeSlides[1].likeCount': result.likeCount,
      });
    } catch (error) {
      this.handleReaderRequestError(error, '点赞操作失败，请稍后重试。');
    }
  },

  async handleToggleEpisodeFavorite() {
    const activeEpisode = this.data.episodeSlides[1];
    if (!activeEpisode?.id || !(await this.ensureLoggedIn())) {
      return;
    }

    try {
      const result = activeEpisode.isFavorited
        ? await readerApi.deleteEpisodeFavorite(activeEpisode.id)
        : await readerApi.createEpisodeFavorite(activeEpisode.id);
      if (!this.isPageActive) {
        return;
      }

      this.setData({
        'episodeSlides[1].isFavorited': result.isFavorited,
        'episodeSlides[1].favoriteCount': result.favoriteCount,
      });
    } catch (error) {
      this.handleReaderRequestError(error, '收藏操作失败，请稍后重试。');
    }
  },

  async handleSubmitComment() {
    const activeEpisode = this.data.episodeSlides[1];
    const content = this.data.commentContent.trim();
    if (!activeEpisode?.id || !(await this.ensureLoggedIn())) {
      return;
    }

    if (!content || [...content].length > 200) {
      wx.showToast({ title: '评论需为 1 至 200 个字符。', icon: 'none' });
      return;
    }

    this.setData({ isSubmittingComment: true });
    try {
      const result = await readerApi.createComment(activeEpisode.id, content);
      if (!this.isPageActive) {
        return;
      }

      this.setData({
        comments: [toCommentItem(result.comment), ...this.data.comments],
        commentContent: '',
        'episodeSlides[1].commentCount': result.commentCount,
      });
    } catch (error) {
      this.handleReaderRequestError(error, '发表评论失败，请稍后重试。');
    } finally {
      if (this.isPageActive) {
        this.setData({ isSubmittingComment: false });
      }
    }
  },

  async handleToggleCommentLike(event) {
    const { commentId } = event.currentTarget.dataset;
    const commentIndex = this.data.comments.findIndex((comment) => comment.id === commentId);
    const comment = this.data.comments[commentIndex];
    if (!comment || !(await this.ensureLoggedIn())) {
      return;
    }

    try {
      const result = comment.isLiked
        ? await readerApi.deleteCommentLike(comment.id)
        : await readerApi.createCommentLike(comment.id);
      if (!this.isPageActive) {
        return;
      }

      this.setData({
        [`comments[${commentIndex}].isLiked`]: result.isLiked,
        [`comments[${commentIndex}].likeCount`]: result.likeCount,
      });
    } catch (error) {
      this.handleReaderRequestError(error, '评论点赞操作失败，请稍后重试。');
    }
  },

  handleDeleteComment(event) {
    const { commentId } = event.currentTarget.dataset;
    wx.showModal({
      title: '删除评论',
      content: '删除后无法恢复，是否继续？',
      success: ({ confirm }) => {
        if (confirm) {
          this.deleteComment(commentId);
        }
      },
    });
  },

  async deleteComment(commentId) {
    if (!(await this.ensureLoggedIn())) {
      return;
    }

    try {
      await readerApi.deleteComment(commentId);
      if (!this.isPageActive) {
        return;
      }

      const commentIndex = this.data.comments.findIndex((comment) => comment.id === commentId);
      const activeEpisode = this.data.episodeSlides[1];
      if (commentIndex < 0 || !activeEpisode) {
        return;
      }

      this.setData({
        comments: this.data.comments.filter((comment) => comment.id !== commentId),
        'episodeSlides[1].commentCount': Math.max(0, activeEpisode.commentCount - 1),
      });
    } catch (error) {
      this.handleReaderRequestError(error, '删除评论失败，请稍后重试。');
    }
  },

  async ensureLoggedIn() {
    if (readerStore.hasActiveSession()) {
      return true;
    }

    try {
      await loginReader();
      return true;
    } catch (error) {
      wx.showToast({ title: error.message || '请先微信登录后再操作。', icon: 'none' });
      return false;
    }
  },

  handleReaderRequestError(error, fallbackMessage) {
    if (error.code === 'READER_AUTH_REQUIRED') {
      readerStore.clearSession();
    }

    wx.showToast({ title: error.message || fallbackMessage, icon: 'none' });
  },

  onShareAppMessage() {
    const activeEpisode = this.data.episodeSlides[1];

    if (activeEpisode?.id) {
      discoveryApi.recordEpisodeShare(activeEpisode.id).then((result) => {
        if (this.isPageActive) {
          this.setData({ 'episodeSlides[1].shareCount': result.shareCount ?? activeEpisode.shareCount });
        }
      }).catch((error) => {
        console.warn('分享计数失败', { episodeId: activeEpisode.id, error });
      });
    }

    return {
      title: activeEpisode?.title || '漫画条',
      path: `/packageReader/reader/reader?episodeId=${encodeURIComponent(activeEpisode?.id || '')}`,
    };
  },
});
