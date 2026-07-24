import request, { setCsrfToken } from '../utils/request';
import { comicsAPI } from './comics';

/**
 * 管理员认证 API
 * CSRF token 在 API 层剥离并存入请求模块私有内存，不进入 Redux
 */
class AuthAPI {
  basePath = '/admin/auth';

  /**
   * 管理员登录
   * @param {{ username: string, password: string }} params
   * @returns {Promise<{ admin: object, session: object, serverTime: string }>}
   */
  async login({ username, password }) {
    const { data } = await request.post(`${this.basePath}/login`, { username, password });
    // csrfToken 从响应中剥离，不进入 Redux
    const { csrfToken, ...sessionData } = data;
    if (csrfToken) {
      setCsrfToken(csrfToken);
    }
    return sessionData;
  }

  /**
   * 恢复管理员会话
   * @returns {Promise<{ admin: object, session: object, serverTime: string }>}
   */
  async getSession() {
    const { data } = await request.get(`${this.basePath}/session`);
    const { csrfToken, ...sessionData } = data;
    if (csrfToken) {
      setCsrfToken(csrfToken);
    }
    return sessionData;
  }

  /**
   * 管理员登出
   * @returns {Promise<void>}
   */
  async logout() {
    await request.post(`${this.basePath}/logout`);
  }

  /**
   * 修改管理员密码（成功后清除全部会话，需重新登录）
   * @param {{ currentPassword: string, newPassword: string }} params
   * @returns {Promise<void>}
   */
  async updatePassword({ currentPassword, newPassword }) {
    await request.patch(`${this.basePath}/password`, { currentPassword, newPassword });
  }
}

export const authAPI = new AuthAPI();

// 内容运营 API 统一导出
export { comicsAPI };
export { imageAPI } from './image';
export { seriesAPI } from './series';
