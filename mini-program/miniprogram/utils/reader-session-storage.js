const READER_SESSION_STORAGE_KEY = 'reader_session';

function hasExpiredSession(session) {
  const expiresAt = Date.parse(session.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt <= Date.now();
}

/**
 * 读取本地保存的读者会话。令牌只用于请求头，不能写入日志或页面数据。
 *
 * @returns {{sessionToken: string, reader: object} | null} 有效的本地会话。
 */
function getReaderSession() {
  if (typeof wx === 'undefined' || typeof wx.getStorageSync !== 'function') {
    return null;
  }

  const session = wx.getStorageSync(READER_SESSION_STORAGE_KEY);
  if (!session || typeof session.sessionToken !== 'string' || !session.sessionToken) {
    return null;
  }

  if (hasExpiredSession(session)) {
    clearReaderSession();
    return null;
  }

  return session;
}

/**
 * @returns {string} 当前读者会话令牌；未登录时为空字符串。
 */
function getReaderSessionToken() {
  return getReaderSession()?.sessionToken || '';
}

/**
 * @param {{sessionToken: string, expiresAt: string, reader: object}} session 后端登录成功返回的读者会话。
 */
function saveReaderSession(session) {
  if (typeof wx !== 'undefined' && typeof wx.setStorageSync === 'function') {
    wx.setStorageSync(READER_SESSION_STORAGE_KEY, session);
  }
}

function clearReaderSession() {
  if (typeof wx !== 'undefined' && typeof wx.removeStorageSync === 'function') {
    wx.removeStorageSync(READER_SESSION_STORAGE_KEY);
  }
}

module.exports = {
  clearReaderSession,
  getReaderSession,
  getReaderSessionToken,
  saveReaderSession,
};
