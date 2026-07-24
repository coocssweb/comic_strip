import request from '../utils/request';

/**
 * 图片上传 API
 * 两阶段 STS 直传 COS：先申请凭证 → 直传 → 确认绑定
 */
class ImageAPI {
  /**
   * 申请 STS 上传凭证
   * @param {string} comicId
   * @param {{ fileName: string, contentType: string, contentLength: number }} params
   * @returns {Promise<{ method: string, uploadUrl: string, headers: object }>}
   */
  async requestSts(comicId, params) {
    const { data } = await request.post(`/api/v1/comics/${comicId}/images/sts`, params);
    return data;
  }

  /**
   * 确认绑定封面和正文图片
   * @param {string} comicId
   * @param {{ cover?: string, bodyImages?: string[] }} payload
   * @returns {Promise<object>} 更新后的 Comic 对象
   */
  async bindImages(comicId, payload) {
    const { data } = await request.put(`/api/v1/comics/${comicId}/images`, payload);
    return data;
  }
}

export const imageAPI = new ImageAPI();
