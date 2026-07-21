import axios from 'axios';

const request = axios.create({
  baseURL: process.env.APP_API_BASE_URL,
  timeout: 15000,
});

request.interceptors.request.use((config) => {
  const sessionToken = localStorage.getItem('admin-session-token');

  if (sessionToken) {
    config.headers.Authorization = `Bearer ${sessionToken}`;
  }

  return config;
});

request.interceptors.response.use(
  (response) => {
    const payload = response.data;

    if (payload?.code !== 'OK') {
      return Promise.reject(new Error(payload?.message || '请求未成功完成。'));
    }

    return payload.data;
  },
  (error) => {
    const message = error.response?.data?.message || error.message || '网络请求失败，请稍后重试。';
    return Promise.reject(new Error(message));
  },
);

export default request;
