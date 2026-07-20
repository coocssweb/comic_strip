import request from '../utils/request';

class AdminAuthApi {
  login(credentials) {
    return request.post('/admin/auth/login', credentials);
  }

  logout() {
    return request.post('/auth/logout');
  }
}

export const adminAuthApi = new AdminAuthApi();
