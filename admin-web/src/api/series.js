import request from '../utils/request';

/**
 * 连载系列 API（占位）
 * 后续 Issue 实现完整 CRUD，当前仅提供列表查询供 FormSelect 使用
 */
class SeriesAPI {
  basePath = '/series';

  /**
   * 查询连载列表
   * @returns {Promise<{ items: object[] }>}
   */
  async list() {
    const { data } = await request.get(this.basePath);
    return data;
  }
}

export const seriesAPI = new SeriesAPI();
