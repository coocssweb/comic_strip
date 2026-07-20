const { action, observable } = require('mobx-miniprogram');
const { clearReaderSession, getReaderSession, saveReaderSession } = require('../utils/reader-session-storage');

const storedSession = getReaderSession();

const readerStore = observable({
  reader: storedSession?.reader || null,
  sessionToken: storedSession?.sessionToken || '',

  get isLoggedIn() {
    return Boolean(this.sessionToken && this.reader);
  },

  /**
   * 会话过期时间由服务端签发；每次进入需要读者身份的流程前重新校验，避免多一次失败请求。
   *
   * @returns {boolean} 当前会话是否仍可用。
   */
  hasActiveSession: action(function () {
    const session = getReaderSession();
    if (!session || session.sessionToken !== this.sessionToken) {
      this.clearSession();
      return false;
    }

    return Boolean(this.reader);
  }),

  /**
   * 会话令牌与读者资料必须一起更新，防止页面显示旧资料却使用新会话。
   *
   * @param {{sessionToken: string, expiresAt: string, reader: object}} session 登录接口返回的会话。
   */
  setSession: action(function (session) {
    this.sessionToken = session.sessionToken;
    this.reader = session.reader;
    saveReaderSession(session);
  }),

  /** @param {object} reader 后端确认的当前读者资料。 */
  setReader: action(function (reader) {
    this.reader = reader;
    if (this.sessionToken) {
      saveReaderSession({ sessionToken: this.sessionToken, reader });
    }
  }),

  clearSession: action(function () {
    this.sessionToken = '';
    this.reader = null;
    clearReaderSession();
  }),
});

module.exports = {
  readerStore,
};
