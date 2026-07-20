import mongoose from 'mongoose';
import '../models/index.js';
import { env } from './env.js';

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/**
 * 开发和测试环境由 Mongoose 为完整模型注册表自动建索引；生产环境必须走显式迁移入口。
 * @param {string} nodeEnv 当前运行环境。
 * @returns {{ autoIndex: boolean }} Mongoose 连接选项。
 */
export function getDatabaseConnectionOptions(nodeEnv) {
  return { autoIndex: ['development', 'test'].includes(nodeEnv) };
}

export async function connectDatabase() {
  for (let attempt = 1; attempt <= env.mongodbRetryTimes; attempt += 1) {
    try {
      await mongoose.connect(env.mongodbUri, getDatabaseConnectionOptions(env.nodeEnv));

      console.info('MongoDB 连接成功');
      return;
    } catch {
      console.error(`MongoDB 第 ${attempt} 次连接失败`);

      if (attempt === env.mongodbRetryTimes) {
        throw new Error('MongoDB 连接重试耗尽，服务未启动');
      }

      await wait(env.mongodbRetryIntervalMs);
    }
  }
}
