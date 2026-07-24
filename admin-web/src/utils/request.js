import axios from 'axios';

// CSRF 令牌保存在模块私有内存中，不进入 Redux / localStorage / sessionStorage / URL
let csrfToken = null;
let onAuthInvalid = null;

const request = axios.create({
  // Cookie 凭据模式：携带 HttpOnly Cookie，不手动设置 Authorization
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * 请求拦截器：为所有写请求自动附加 X-CSRF-Token
 * 会话恢复不要求该请求头，因此只对已有 token 的请求添加
 */
request.interceptors.request.use((config) => {
  if (csrfToken && ['post', 'patch', 'delete', 'put'].includes(config.method)) {
    config.headers['X-CSRF-Token'] = csrfToken;
  }
  return config;
});

/**
 * 响应拦截器：业务失败按后端响应 code 判断
 * - 401 ADMIN_AUTH_REQUIRED：清除 CSRF token 并通知认证失效
 * - 503 / 500 等：不主动清除 CSRF token 或 Cookie 语义
 * - 所有错误统一附加 code 和 message 字段，便于上层业务判断
 */
request.interceptors.response.use(
  (response) => response,
  (error) => {
    const { response } = error;
    if (response) {
      const body = response.data;
      // 仅对确定的 401 ADMIN_AUTH_REQUIRED 清除 CSRF token
      if (response.status === 401 && body?.code === 'ADMIN_AUTH_REQUIRED') {
        clearCsrfToken();
        if (onAuthInvalid) {
          onAuthInvalid();
        }
      }
      // 构造统一错误对象，携带业务 code 与 message
      const enriched = new Error(body?.message || `请求失败 (${response.status})`);
      enriched.code = body?.code || `HTTP_${response.status}`;
      enriched.message = body?.message || enriched.message;
      enriched.status = response.status;
      enriched.requestId = body?.requestId;
      return Promise.reject(enriched);
    }
    // 网络错误 / CORS 错误 / 超时
    const networkError = new Error('网络连接失败，请检查网络');
    networkError.code = 'NETWORK_ERROR';
    return Promise.reject(networkError);
  },
);

/** 设置内存 CSRF token（登录/会话恢复成功后调用） */
export function setCsrfToken(token) {
  csrfToken = token;
}

/** 清除内存 CSRF token（登出/authInvalid 时调用） */
export function clearCsrfToken() {
  csrfToken = null;
}

/** 获取当前 CSRF token（仅用于测试或拦截器内部） */
export function getCsrfToken() {
  return csrfToken;
}

/**
 * 注册认证失效回调
 * 用于请求层在 401 时通知 authSlice 失效
 * 仅 useAuth hook 内部调用一次
 */
export function setAuthInvalidListener(fn) {
  onAuthInvalid = fn;
}

export default request;
