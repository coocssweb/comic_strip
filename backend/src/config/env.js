import dotenv from 'dotenv';

dotenv.config();

function parsePositiveInteger(rawValue, variableName) {
  if (typeof rawValue !== 'string' || !/^[1-9]\d*$/.test(rawValue)) {
    throw new Error(`环境变量 ${variableName} 必须是正整数`);
  }

  const value = Number(rawValue);

  if (!Number.isSafeInteger(value)) {
    throw new Error(`环境变量 ${variableName} 必须是正整数`);
  }

  return value;
}

function requireString(variableName) {
  const value = process.env[variableName];

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`缺少环境变量 ${variableName}`);
  }

  return value.trim();
}

function parseHttpsUrl(rawValue, variableName) {
  try {
    const url = new URL(rawValue);

    if (url.protocol !== 'https:') {
      throw new Error('协议不合法');
    }

    return url.href.endsWith('/') ? url.href : `${url.href}/`;
  } catch {
    throw new Error(`环境变量 ${variableName} 必须是 HTTPS 地址`);
  }
}

const mongodbUri = process.env.MONGODB_URI;

if (!mongodbUri) {
  throw new Error('缺少环境变量 MONGODB_URI');
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parsePositiveInteger(process.env.PORT === undefined ? '3000' : process.env.PORT, 'PORT'),
  mongodbUri,
  mongodbRetryTimes: parsePositiveInteger(
    process.env.MONGODB_RETRY_TIMES === undefined ? '3' : process.env.MONGODB_RETRY_TIMES,
    'MONGODB_RETRY_TIMES',
  ),
  mongodbRetryIntervalMs: parsePositiveInteger(
    process.env.MONGODB_RETRY_INTERVAL_MS === undefined
      ? '2000'
      : process.env.MONGODB_RETRY_INTERVAL_MS,
    'MONGODB_RETRY_INTERVAL_MS',
  ),
  wechatAppId: requireString('WECHAT_APP_ID'),
  wechatAppSecret: requireString('WECHAT_APP_SECRET'),
  adminUsername: requireString('ADMIN_USERNAME'),
  adminPasswordHash: requireString('ADMIN_PASSWORD_HASH'),
  sessionSecret: requireString('SESSION_SECRET'),
  sessionExpiresSeconds: parsePositiveInteger(
    process.env.SESSION_EXPIRES_SECONDS === undefined
      ? '604800'
      : process.env.SESSION_EXPIRES_SECONDS,
    'SESSION_EXPIRES_SECONDS',
  ),
  cosBucket: requireString('COS_BUCKET'),
  cosRegion: requireString('COS_REGION'),
  cosPublicBaseUrl: parseHttpsUrl(requireString('COS_PUBLIC_BASE_URL'), 'COS_PUBLIC_BASE_URL'),
  cosUploadExpiresSeconds: parsePositiveInteger(
    process.env.COS_UPLOAD_EXPIRES_SECONDS === undefined
      ? '300'
      : process.env.COS_UPLOAD_EXPIRES_SECONDS,
    'COS_UPLOAD_EXPIRES_SECONDS',
  ),
  cosAccessKeyId: requireString('COS_ACCESS_KEY_ID'),
  cosSecretAccessKey: requireString('COS_SECRET_ACCESS_KEY'),
};
