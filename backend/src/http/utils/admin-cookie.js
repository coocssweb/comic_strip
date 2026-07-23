/**
 * 根据运行环境返回管理员会话 Cookie 名称。
 *
 * 生产环境使用 __Host- 前缀以启用浏览器 Cookie 安全绑定；
 * 其他环境使用不带前缀的名称以兼容非 HTTPS 开发环境。
 *
 * @param {string} nodeEnv 运行环境标识
 * @returns {string} Cookie 名称
 */
export function getAdminCookieName(nodeEnv) {
  return nodeEnv === 'production' ? '__Host-admin_session' : 'admin_session';
}
