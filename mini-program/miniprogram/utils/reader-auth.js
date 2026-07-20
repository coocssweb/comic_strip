const { readerApi } = require('../api/reader');
const { readerStore } = require('../stores/reader');

function createAuthorizationError(message) {
  return new Error(message);
}

function getWechatLoginCode() {
  return new Promise((resolve, reject) => {
    wx.login({
      success(result) {
        if (result.code) {
          resolve(result.code);
          return;
        }

        reject(createAuthorizationError('微信登录已失效，请重新登录。'));
      },
      fail() {
        reject(createAuthorizationError('微信登录已失效，请重新登录。'));
      },
    });
  });
}

function getWechatProfile() {
  return new Promise((resolve, reject) => {
    wx.getUserProfile({
      desc: '用于展示您的昵称和头像',
      success(result) {
        const userInfo = result.userInfo || {};
        resolve({
          displayName: userInfo.nickName || '读者',
          avatarUrl: userInfo.avatarUrl || '',
        });
      },
      fail() {
        reject(createAuthorizationError('已取消微信授权。'));
      },
    });
  });
}

/**
 * 只能由用户点击写操作或登录入口触发，避免未经授权调用微信资料接口。
 *
 * @returns {Promise<object>} 已登录读者资料。
 */
async function loginReader() {
  if (typeof wx === 'undefined' || typeof wx.login !== 'function' || typeof wx.getUserProfile !== 'function') {
    throw createAuthorizationError('当前环境不支持微信登录。');
  }

  const [code, profile] = await Promise.all([getWechatLoginCode(), getWechatProfile()]);
  const session = await readerApi.wechatLogin({ code, profile });
  readerStore.setSession(session);
  return session.reader;
}

module.exports = {
  loginReader,
};
