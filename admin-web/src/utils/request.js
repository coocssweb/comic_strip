import axios from 'axios';

let memoryCsrfToken = null;
let authInvalidListener = null;

export function setCsrfToken(token) {
  memoryCsrfToken = token || null;
}

export function clearCsrfToken() {
  memoryCsrfToken = null;
}

export function getCsrfToken() {
  return memoryCsrfToken;
}

export function setAuthInvalidListener(listener) {
  authInvalidListener = listener;
}

const request = axios.create({
  baseURL: process.env.APP_API_BASE_URL || 'http://localhost:40001',
  timeout: 15000,
  withCredentials: true,
});

request.interceptors.request.use((config) => {
  const method = (config.method || 'get').toLowerCase();
  const isWriteMethod = ['post', 'patch', 'put', 'delete'].includes(method);

  if (isWriteMethod && memoryCsrfToken) {
    config.headers['X-CSRF-Token'] = memoryCsrfToken;
  }

  return config;
});

request.interceptors.response.use(
  (response) => {
    const data = response.data;
    if (data && typeof data === 'object' && data.csrfToken) {
      setCsrfToken(data.csrfToken);
    }
    return data;
  },
  (error) => {
    const response = error.response;
    const data = response?.data;
    const status = response?.status;

    if (status === 401 && data?.code === 'ADMIN_AUTH_REQUIRED') {
      clearCsrfToken();
      if (typeof authInvalidListener === 'function') {
        authInvalidListener();
      }
    }

    const apiError = new Error(data?.message || error.message || '网络请求失败，请稍后重试');
    apiError.code = data?.code || (status ? `HTTP_${status}` : 'NETWORK_ERROR');
    apiError.status = status;
    apiError.requestId = data?.requestId;
    apiError.fieldErrors = data?.fieldErrors;

    return Promise.reject(apiError);
  },
);

export default request;
