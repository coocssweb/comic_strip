import request from '../utils/request';

class SeriesAPI {
  basePath = '/api/v1/series';

  async list(params) {
    const { data } = await request.get(this.basePath, { params });
    return data;
  }

  async getById(id) {
    const { data } = await request.get(this.basePath + '/' + id);
    return data;
  }

  async create(payload) {
    const { data } = await request.post(this.basePath, payload);
    return data;
  }

  async update(id, payload) {
    const { data } = await request.put(this.basePath + '/' + id, payload);
    return data;
  }

  async publish(id) {
    const { data } = await request.post(this.basePath + '/' + id + '/publish');
    return data;
  }

  async unpublish(id) {
    const { data } = await request.post(this.basePath + '/' + id + '/unpublish');
    return data;
  }

  async remove(id) {
    await request.delete(this.basePath + '/' + id);
  }

  async restore(id) {
    const { data } = await request.post(this.basePath + '/' + id + '/restore');
    return data;
  }
}

export const seriesAPI = new SeriesAPI();
