import assert from 'node:assert/strict';
import test from 'node:test';

import mongoose from 'mongoose';

test('数据库连接显式关闭 Mongoose 自动索引', async (testContext) => {
  Object.assign(process.env, {
    NODE_ENV: 'production',
    MONGODB_URI: 'mongodb://127.0.0.1:27017/comic-strip-test',
    MONGODB_RETRY_TIMES: '1',
    WECHAT_APP_ID: 'test-wechat-app-id',
    WECHAT_APP_SECRET: 'test-wechat-app-secret',
    ADMIN_USERNAME: 'test-admin',
    ADMIN_PASSWORD_HASH: 'test-password-hash',
    SESSION_SECRET: 'test-session-secret',
    COS_BUCKET: 'test-bucket-1234567890',
    COS_REGION: 'ap-shanghai',
    COS_PUBLIC_BASE_URL: 'https://test-bucket-1234567890.cos.ap-shanghai.myqcloud.com/',
    COS_ACCESS_KEY_ID: 'test-access-key-id',
    COS_SECRET_ACCESS_KEY: 'test-secret-access-key',
  });
  const { connectDatabase } = await import('../src/config/database.js');
  const originalConnect = mongoose.connect;
  const originalInfo = console.info;
  const calls = [];
  mongoose.connect = async (...args) => {
    calls.push(args);
  };
  console.info = () => {};
  testContext.after(() => {
    mongoose.connect = originalConnect;
    console.info = originalInfo;
  });

  await connectDatabase();

  assert.deepEqual(calls, [
    ['mongodb://127.0.0.1:27017/comic-strip-test', { autoIndex: false }],
  ]);
});
