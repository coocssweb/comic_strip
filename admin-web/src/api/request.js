import axios from 'axios';
import { store } from '../store';
import { logout } from '../store/authSlice';
import Toast from '@components/Toast';

let routerInstance = null;

export const injectRouter = (router) => {
  routerInstance = router;
};

const request = axios.create({
  baseURL: process.env.APP_API_BASE_URL || 'http://localhost:6010/api',
  timeout: 10000
});

// 独立的上报实例（避免拦截器循环）
const reportAxios = axios.create({
  baseURL: process.env.APP_API_BASE_URL || 'http://localhost:6010/api',
  timeout: 5000
});

/**
 * 静默上报错误日志到后端（fire-and-forget）
 */
export function reportErrorLog(data) {
  try {
    const authState = store.getState().auth;
    reportAxios.post('/error-logs/report', {
      source: 'admin-web',
      level: 'error',
      type: 'API_ERROR',
      userAgent: navigator.userAgent,
      userId: authState?.userId || localStorage.getItem('userId') || '',
      userName: authState?.nickname || localStorage.getItem('nickname') || '',
      ...data
    }).catch(() => {});
  } catch {
    // 静默忽略上报失败
  }
}

// ============================================
// 请求拦截器：自动挂载 JWT Token
// ============================================
request.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ============================================
// 响应拦截器：统一处理 401 会话过期自动登出 + 错误上报
// ============================================
request.interceptors.response.use(
  (response) => {
    const res = response.data;
    // 业务层 code === 401（部分接口通过 HTTP 200 携带业务 401）
    if (res && res.code === 401) {
      handleUnauthorized();
    }
    // 业务层错误上报（排除 401 和成功）
    if (res && res.code !== 200 && res.code !== 401) {
      reportErrorLog({
        message: res.msg || '业务请求失败',
        url: response.config.url,
        method: (response.config.method || '').toUpperCase(),
        statusCode: response.status,
        businessCode: res.code,
        requestBody: response.config.data ? safeParseJSON(response.config.data) : null,
        responseBody: res
      });
    }
    return response;
  },
  (error) => {
    // HTTP 层 status 401
    if (error.response && error.response.status === 401) {
      handleUnauthorized();
    } else {
      // 网络错误 / 非 401 HTTP 错误上报
      reportErrorLog({
        message: error.message || '网络请求失败',
        url: error.config?.url,
        method: (error.config?.method || '').toUpperCase(),
        statusCode: error.response?.status || 0,
        requestBody: error.config?.data ? safeParseJSON(error.config.data) : null,
        responseBody: error.response?.data || null
      });
    }
    return Promise.reject(error);
  }
);

/**
 * 安全解析 JSON 字符串，失败则原样返回
 */
function safeParseJSON(str) {
  if (typeof str !== 'string') return str;
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

/**
 * 统一会话失效处理：
 * 1. 清除本地存储 token
 * 2. 清空 Redux auth 状态
 * 3. 弹出 toast 提示
 * 4. 路由跳转回登录页
 */
function handleUnauthorized() {
  // 防重入：若已跳转则不再重复触发
  if (window.__unauthorized_redirecting__) return;
  window.__unauthorized_redirecting__ = true;

  // 派发登出 action（清除 Redux + localStorage）
  store.dispatch(logout());

  // 弹出吐司通知
  Toast.Error('登录已失效，请重新登录');

  // 延迟 300ms 路由跳转，让 toast 先出现
  setTimeout(() => {
    window.__unauthorized_redirecting__ = false;
    if (routerInstance) {
      routerInstance.navigate('/login');
    } else {
      window.location.href = '/login';
    }
  }, 300);
}

/**
 * 轻量级 Toast 提示（无需额外依赖）
 * 在右上角显示"登录失效，请重新登录"的吐司通知
 */

export default request;

