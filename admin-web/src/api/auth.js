import request, { clearCsrfToken } from '../utils/request';

/**
 * 管理员认证相关 API
 */
class AuthAPI {
  basePath = '/admin/auth';

  /**
   * 管理员登录
   * @param {{username: string, password: string}} data
   */
  login(data) {
    return request.post(`${this.basePath}/login`, data);
  }

  /**
   * 恢复并读取当前管理会话
   */
  getSession() {
    return request.get(`${this.basePath}/session`);
  }

  /**
   * 撤销当前管理会话
   */
  async logout() {
    try {
      return await request.post(`${this.basePath}/logout`);
    } finally {
      clearCsrfToken();
    }
  }

  /**
   * 修改密码并撤销全部管理会话
   * @param {{currentPassword: string, newPassword: string}} data
   */
  async updatePassword(data) {
    try {
      return await request.patch(`${this.basePath}/password`, data);
    } finally {
      clearCsrfToken();
    }
  }
}

export const authAPI = new AuthAPI();
