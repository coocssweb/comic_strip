import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

import { checkLoginThrottle, recordLoginFailure, resetUsernameThrottle } from '../src/security/login-throttler.js';
import { openIsolatedTestDatabase } from './helpers/test-mongodb.js';

const TEST_CONFIG = Object.freeze({
  securityHmacSecret: randomBytes(32),
});

describe('MongoDB 持久限速 login-throttler 测试', () => {
  let testDb;

  before(async () => {
    testDb = await openIsolatedTestDatabase();
  });

  after(async () => {
    if (testDb) {
      await testDb.dropAndClose();
    }
  });

  test('初始状态未被限速', async () => {
    const res = await checkLoginThrottle(testDb.connection.db, { ip: '127.0.0.1', username: 'admin' }, TEST_CONFIG);
    assert.equal(res.isThrottled, false);
    assert.ok(res.ipKeyHash);
    assert.ok(res.usernameKeyHash);
  });

  test('单次失败计算递增延迟，成功重置用户名限速桶', async () => {
    const checkBefore = await checkLoginThrottle(testDb.connection.db, { ip: '127.0.0.1', username: 'admin' }, TEST_CONFIG);
    const failRecord = await recordLoginFailure(testDb.connection.db, checkBefore);

    assert.equal(failRecord.delayMs, 250);

    await resetUsernameThrottle(testDb.connection.db, checkBefore.usernameKeyHash);

    const doc = await testDb.connection.db.collection('admin_throttles').findOne({ _id: `user:${checkBefore.usernameKeyHash}` });
    assert.equal(doc, null);
  });
});
