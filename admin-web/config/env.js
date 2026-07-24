/**
 * 应用配置 — 根据运行模式返回对应配置
 * envName 可选: development / production
 */
function loadAppConfig({ envName } = {}) {
  const isProduction = envName === 'production';
  return {
    port: parseInt(process.env.ADMIN_WEB_PORT || '4000', 10),
    apiBaseUrl: process.env.ADMIN_API_BASE_URL || 'http://localhost:4001',
    title: '四格漫画',
    shortTitle: '漫画',
  };
}

module.exports = { loadAppConfig };
