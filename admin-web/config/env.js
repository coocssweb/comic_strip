const fs = require('fs');
const path = require('path');

function normalizeEnvName(envName) {
  if (envName === 'dev' || envName === 'development') return 'development';
  if (envName === 'prod' || envName === 'production') return 'production';
  if (envName === 'test') return 'test';
  return 'development';
}

function resolveEnvName(env = process.env) {
  return normalizeEnvName(env.APP_ENV || env.NODE_ENV || 'development');
}

function parseEnv(content) {
  return content.split(/\r?\n/).reduce((result, line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return result;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) return result;

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    result[key] = rawValue.replace(/^['"]|['"]$/g, '');
    return result;
  }, {});
}

function loadEnvFile(rootDir, envName) {
  const normalizedEnv = normalizeEnvName(envName);
  const files = [path.join(rootDir, '.env'), path.join(rootDir, `.env.${normalizedEnv}`)];

  return files.reduce((env, file) => {
    if (!fs.existsSync(file)) return env;
    return { ...env, ...parseEnv(fs.readFileSync(file, 'utf8')) };
  }, {});
}

function createAppConfig({ env = process.env, defaultPort = 6002, envName = resolveEnvName(env) } = {}) {
  return {
    envName: normalizeEnvName(envName),
    port: Number.parseInt(env.APP_PORT, 10) || defaultPort,
    apiBaseUrl: env.APP_API_BASE_URL,
    title: env.APP_TITLE,
    shortTitle: env.APP_SHORT_TITLE
  };
}

function loadAppConfig({ rootDir = path.join(__dirname, '..'), defaultPort = 6002, envName = resolveEnvName() } = {}) {
  const fileEnv = loadEnvFile(rootDir, envName);
  return createAppConfig({
    env: { ...fileEnv, ...process.env },
    defaultPort,
    envName
  });
}

const appConfig = loadAppConfig();

module.exports = {
  appConfig,
  createAppConfig,
  loadAppConfig,
  loadEnvFile,
  normalizeEnvName,
  resolveEnvName
};
