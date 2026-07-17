import mongoose from 'mongoose';
import { env } from './env.js';

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function connectDatabase() {
  for (let attempt = 1; attempt <= env.mongodbRetryTimes; attempt += 1) {
    try {
      await mongoose.connect(env.mongodbUri);
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
