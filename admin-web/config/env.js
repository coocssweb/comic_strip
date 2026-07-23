const path = require('path');
const fs = require('fs');

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      env[key] = val;
    }
  }
  return env;
}

function loadAppConfig({ envName } = {}) {
  const isProduction = envName === 'production';
  const fileName = isProduction ? '.env.production' : '.env.development';
  const filePath = path.resolve(__dirname, '..', fileName);
  const fileEnv = parseEnvFile(filePath);

  const apiBaseUrl = process.env.APP_API_BASE_URL
    || fileEnv.APP_API_BASE_URL
    || (isProduction ? 'https://apis.example.com' : 'http://localhost:40001');

  const port = Number(process.env.APP_PORT || fileEnv.APP_PORT || 4000);

  return {
    apiBaseUrl,
    port,
    title: '天天种草平台管理端',
    shortTitle: '天天种草',
  };
}

module.exports = { loadAppConfig };
