import assert from 'node:assert/strict';
import test from 'node:test';

test('开发和测试环境开启自动索引，生产环境关闭自动索引', async () => {
  Object.assign(process.env, {
    MONGODB_URI: 'mongodb://127.0.0.1:27017/comic-strip-test',
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
  const { getDatabaseConnectionOptions } = await import('../src/config/database.js');

  assert.deepEqual(getDatabaseConnectionOptions('development'), { autoIndex: true });
  assert.deepEqual(getDatabaseConnectionOptions('test'), { autoIndex: true });
  assert.deepEqual(getDatabaseConnectionOptions('production'), { autoIndex: false });
});
