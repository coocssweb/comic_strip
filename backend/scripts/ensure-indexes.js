import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { ensureRegisteredModelIndexes } from '../src/models/index.js';

async function ensureIndexes() {
  try {
    await mongoose.connect(env.mongodbUri, { autoIndex: false });
    await ensureRegisteredModelIndexes();
    console.info('全部模型索引补建完成');
  } catch {
    console.error('模型索引补建失败');
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

void ensureIndexes();
