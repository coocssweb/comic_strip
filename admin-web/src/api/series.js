import request from '../utils/request';

/**
 * 连载系列 API
 * 涵盖 CRUD、生命周期操作和分页列表查询
 */
class SeriesAPI {
  basePath = '/api/v1/series';

  /**
   * 查询连载列表（分页 + 状态筛选）
   * @param {{ status?: string, page?: number, pageSize?: number }} [params]
   * @returns {Promise<{ items: object[], total: number, page: number, pageSize: number }>}
   */
  async list(params) {
    const { data } = await request.get(this.basePath, { params });
    return data;
  }

  /**
   * 查询单本连载（含成员漫画展开）
   * @param {string} id
   * @returns {Promise<object>}
   */
  async getById(id) {
    const { data } = await request.get(\/\);
    return data;
  }

  /**
   * 创建连载草稿
   * @param {{ title: string, isCompleted?: boolean, comics?: Array<{comicId: string, order: number}> }} payload
   * @returns {Promise<object>}
   */
  async create(payload) {
    const { data } = await request.post(this.basePath, payload);
    return data;
  }

  /**
   * 更新连载元信息（标题、完结状态、成员漫画全量替换）
   * @param {string} id
   * @param {{ title?: string, isCompleted?: boolean, comics?: Array<{comicId: string, order: number}> }} payload
   * @returns {Promise<object>}
   */
  async update(id, payload) {
    const { data } = await request.put(\/\, payload);
    return data;
  }

  /**
   * 发布连载（draft 或 unpublished → published）
   * @param {string} id
   * @returns {Promise<object>}
   */
  async publish(id) {
    const { data } = await request.post(\/\/publish\);
    return data;
  }

  /**
   * 下架连载（published → unpublished）
   * @param {string} id
   * @returns {Promise<object>}
   */
  async unpublish(id) {
    const { data } = await request.post(\/\/unpublish\);
    return data;
  }

  /**
   * 软删除连载（draft 或 unpublished → deleted）
   * @param {string} id
   * @returns {Promise<void>}
   */
  async remove(id) {
    await request.delete(\/\);
  }

  /**
   * 恢复已删除连载（deleted → draft）
   * @param {string} id
   * @returns {Promise<object>}
   */
  async restore(id) {
    const { data } = await request.post(\/\/restore\);
    return data;
  }
}

export const seriesAPI = new SeriesAPI();
