import request from '../utils/request';

class ContentApi {
  listTags() { return request.get('/admin/tags'); }
  createTag(payload) { return request.post('/admin/tags', payload); }
  updateTag(tagId, payload) { return request.patch(`/admin/tags/${tagId}`, payload); }
  deleteTag(tagId) { return request.delete(`/admin/tags/${tagId}`); }
  listSeries(params) { return request.get('/admin/series', { params }); }
  createSeries(payload) { return request.post('/admin/series', payload); }
  updateSeries(seriesId, payload) { return request.patch(`/admin/series/${seriesId}`, payload); }
  deleteSeries(seriesId) { return request.delete(`/admin/series/${seriesId}`); }
  listEpisodes(params) { return request.get('/admin/episodes', { params }); }
  createEpisode(payload) { return request.post('/admin/episodes', payload); }
  updateEpisode(episodeId, payload) { return request.patch(`/admin/episodes/${episodeId}`, payload); }
  publishEpisode(episodeId) { return request.post(`/admin/episodes/${episodeId}/publish`); }
  unpublishEpisode(episodeId) { return request.post(`/admin/episodes/${episodeId}/unpublish`); }
  deleteEpisode(episodeId) { return request.delete(`/admin/episodes/${episodeId}`); }
  listTopics(params) { return request.get('/admin/topics', { params }); }
  createTopic(payload) { return request.post('/admin/topics', payload); }
  getTopic(topicId) { return request.get(`/admin/topics/${topicId}`); }
  updateTopic(topicId, payload) { return request.patch(`/admin/topics/${topicId}`, payload); }
  deleteTopic(topicId) { return request.delete(`/admin/topics/${topicId}`); }
}

export const contentApi = new ContentApi();
