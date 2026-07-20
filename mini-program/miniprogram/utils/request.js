const { API_BASE_URL } = require('../config');
const { getReaderSessionToken } = require('./reader-session-storage');

function createRequestError(message, code) {
  const error = new Error(message || '请求失败，请稍后重试。');
  error.code = code || '';
  return error;
}

/**
 * 发送小程序 API 请求，并以业务码 `OK` 作为成功条件。
 *
 * @param {{path: string, method?: string, data?: object, showLoading?: boolean, includeReaderSession?: boolean}} options 请求配置。
 * @returns {Promise<object>} 后端响应中的 `data` 字段。
 */
function request({ path, method = 'GET', data, showLoading = false, includeReaderSession = false }) {
  return new Promise((resolve, reject) => {
    if (typeof wx === 'undefined' || typeof wx.request !== 'function') {
      reject(createRequestError('当前环境不支持网络请求。'));
      return;
    }

    if (showLoading) {
      wx.showLoading({ title: '加载中', mask: true });
    }

    const sessionToken = includeReaderSession ? getReaderSessionToken() : '';
    const header = {
      'content-type': 'application/json',
    };

    if (sessionToken) {
      header.Authorization = `Bearer ${sessionToken}`;
    }

    wx.request({
      url: `${API_BASE_URL}${path}`,
      method,
      data,
      header,
      success(response) {
        const payload = response.data || {};

        if (response.statusCode >= 200 && response.statusCode < 300 && payload.code === 'OK') {
          resolve(payload.data);
          return;
        }

        reject(createRequestError(payload.message, payload.code));
      },
      fail() {
        reject(createRequestError('网络连接失败，请检查网络后重试。'));
      },
      complete() {
        if (showLoading) {
          wx.hideLoading();
        }
      },
    });
  });
}

module.exports = {
  request,
};
