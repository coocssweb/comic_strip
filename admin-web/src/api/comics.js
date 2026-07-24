import request from '../utils/request';

/**
 * 漫画管理 API
 * 基础路径 /comics，涵盖 CRUD、生命周期和图片上传
 */
class ComicsAPI {
  basePath = '/api/v1/comics';

  /**
   * 查询漫画列表
   * @param {{ status?: string, page?: number, pageSize?: number }} [params]
   * @returns {Promise<{ items: object[], total: number, page: number, pageSize: number }>}
   */
  async list(params) {
    const { data } = await request.get(this.basePath, { params });
    return data;
  }

  /**
   * 查询单本漫画
   * @param {string} id
   * @returns {Promise<object>}
   */
  async getById(id) {
    const { data } = await request.get(`${this.basePath}/${id}`);
    return data;
  }

  /**
   * 创建漫画草稿
   * @param {{ title: string, seriesId?: string, tags?: string[] }} payload
   * @returns {Promise<object>}
   */
  async create(payload) {
    const { data } = await request.post(this.basePath, payload);
    return data;
  }

  /**
   * 更新漫画元信息
   * @param {string} id
   * @param {{ title?: string, seriesId?: string, tags?: string[] }} payload
   * @returns {Promise<object>}
   */
  async update(id, payload) {
    const { data } = await request.put(`${this.basePath}/${id}`, payload);
    return data;
  }

  /**
   * 发布漫画（草稿/已下架 → 已发布）
   * @param {string} id
   * @returns {Promise<object>}
   */
  async publish(id) {
    const { data } = await request.post(`${this.basePath}/${id}/publish`);
    return data;
  }

  /**
   * 下架漫画（已发布 → 已下架）
   * @param {string} id
   * @returns {Promise<object>}
   */
  async unpublish(id) {
    const { data } = await request.post(`${this.basePath}/${id}/unpublish`);
    return data;
  }

  /**
   * 软删除漫画
   * @param {string} id
   * @returns {Promise<void>}
   */
  async remove(id) {
    await request.delete(`${this.basePath}/${id}`);
  }

  /**
   * 恢复已删除漫画（已删除 → 草稿）
   * @param {string} id
   * @returns {Promise<object>}
   */
  async restore(id) {
    const { data } = await request.post(`${this.basePath}/${id}/restore`);
    return data;
  }
}

export const comicsAPI = new ComicsAPI();
