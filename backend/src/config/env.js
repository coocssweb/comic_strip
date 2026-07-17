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
};
