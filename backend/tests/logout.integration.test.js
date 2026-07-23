import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

import { createPrimaryAdmin } from '../src/db/admin-repository.js';
import { createServiceRuntime } from '../src/runtime/service-runtime.js';
import { hashPassword } from '../src/security/password-hasher.js';
import { openIsolatedTestDatabase } from './helpers/test-mongodb.js';

const TEST_SECRET = randomBytes(32).toString('base64');
const TEST_HMAC_SECRET = randomBytes(32).toString('base64');

describe('POST /admin/auth/logout 单会话退出集成测试', () => {
  let testDb;
  let runtime;
  let baseUrl;

  before(async () => {
    testDb = await openIsolatedTestDatabase();

    const passHash = await hashPassword('ValidAdminPassword_12345!');
    await createPrimaryAdmin(testDb.connection.db, {
      username: 'primary_admin',
      passwordHash: passHash,
    });

    const env = {
      NODE_ENV: 'test',
      PORT: '0',
      MONGODB_URI: testDb.uri,
      ADMIN_JWT_SECRET: TEST_SECRET,
      SECURITY_HMAC_SECRET: TEST_HMAC_SECRET,
      ADMIN_WEB_ORIGIN: 'http://localhost:4000',
    };

    runtime = createServiceRuntime({ env });
    const address = await runtime.start();
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    if (runtime) {
      await runtime.shutdown();
    }
    if (testDb) {
      await testDb.dropAndClose();
    }
  });

  test('合法会话配合 CSRF 令牌退出成功返回 204 并仅删除当前会话记录', async () => {
    // 登录会话 A
    const loginA = await fetch(`${baseUrl}/admin/auth/login`, {
      method: 'POST',
      headers: { 'Origin': 'http://localhost:4000', 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'primary_admin', password: 'ValidAdminPassword_12345!' }),
    });
    const cookieA = loginA.headers.get('set-cookie');
    const dataA = await loginA.json();

    // 登录会话 B
    const loginB = await fetch(`${baseUrl}/admin/auth/login`, {
      method: 'POST',
      headers: { 'Origin': 'http://localhost:4000', 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'primary_admin', password: 'ValidAdminPassword_12345!' }),
    });
    const cookieB = loginB.headers.get('set-cookie');

    // 退出会话 A
    const logoutA = await fetch(`${baseUrl}/admin/auth/logout`, {
      method: 'POST',
      headers: { 'Origin': 'http://localhost:4000', 'Cookie': cookieA, 'X-CSRF-Token': dataA.csrfToken },
    });

    assert.equal(logoutA.status, 204);
    assert.ok(logoutA.headers.get('set-cookie')?.includes('admin_session=;'));

    // 验证会话 A 访问已被拒
    const checkA = await fetch(`${baseUrl}/admin/auth/session`, {
      headers: { 'Origin': 'http://localhost:4000', 'Cookie': cookieA },
    });
    assert.equal(checkA.status, 401);

    // 验证会话 B 依然有效
    const checkB = await fetch(`${baseUrl}/admin/auth/session`, {
      headers: { 'Origin': 'http://localhost:4000', 'Cookie': cookieB },
    });
    assert.equal(checkB.status, 200);

    const auditDoc = await testDb.connection.db.collection('security_audits').findOne({ eventType: 'ADMIN_LOGOUT', outcome: 'succeeded' });
    assert.ok(auditDoc);
    assert.equal(auditDoc.revocationScope, 'current');
  });

  test('未认证或已注销会话请求退出返回 204 并清除 Cookie（幂等退出）', async () => {
    const res = await fetch(`${baseUrl}/admin/auth/logout`, {
      method: 'POST',
      headers: { 'Origin': 'http://localhost:4000' },
    });

    assert.equal(res.status, 204);
    assert.ok(res.headers.get('set-cookie')?.includes('admin_session=;'));
  });
});
