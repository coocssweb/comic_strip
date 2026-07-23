import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

import { createPrimaryAdmin } from '../src/db/admin-repository.js';
import { createServiceRuntime } from '../src/runtime/service-runtime.js';
import { hashPassword } from '../src/security/password-hasher.js';
import { openIsolatedTestDatabase } from './helpers/test-mongodb.js';

const TEST_SECRET = randomBytes(32).toString('base64');
const TEST_HMAC_SECRET = randomBytes(32).toString('base64');

describe('GET /admin/auth/session 会话恢复与默认拒绝门禁集成测试', () => {
  let testDb;
  let runtime;
  let baseUrl;
  let validCookie;
  let validCsrfToken;

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

    const loginRes = await fetch(`${baseUrl}/admin/auth/login`, {
      method: 'POST',
      headers: { 'Origin': 'http://localhost:4000', 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'primary_admin', password: 'ValidAdminPassword_12345!' }),
    });

    validCookie = loginRes.headers.get('set-cookie');
    const loginData = await loginRes.json();
    validCsrfToken = loginData.csrfToken;
  });

  after(async () => {
    if (runtime) {
      await runtime.shutdown();
    }
    if (testDb) {
      await testDb.dropAndClose();
    }
  });

  test('未认证请求访问未知管理路径返回 401 ADMIN_AUTH_REQUIRED', async () => {
    const res = await fetch(`${baseUrl}/admin/unknown-route`, {
      headers: { 'Origin': 'http://localhost:4000' },
    });

    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.code, 'ADMIN_AUTH_REQUIRED');
  });

  test('有效会话请求 GET /admin/auth/session 返回 200 OK 且不刷新 JWT/CSRF', async () => {
    const res = await fetch(`${baseUrl}/admin/auth/session`, {
      headers: { 'Origin': 'http://localhost:4000', 'Cookie': validCookie },
    });

    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-store');

    const data = await res.json();
    assert.equal(data.admin.username, 'primary_admin');
    assert.equal(data.csrfToken, validCsrfToken);
  });

  test('已认证请求访问未知管理路径返回 404 NOT_FOUND', async () => {
    const res = await fetch(`${baseUrl}/admin/unknown-route`, {
      headers: { 'Origin': 'http://localhost:4000', 'Cookie': validCookie },
    });

    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.code, 'NOT_FOUND');
  });

  test('已认证写请求缺少或携带错误 CSRF 令牌返回 403 CSRF_VALIDATION_FAILED', async () => {
    const res = await fetch(`${baseUrl}/admin/unknown-route`, {
      method: 'POST',
      headers: { 'Origin': 'http://localhost:4000', 'Cookie': validCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: true }),
    });

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.code, 'CSRF_VALIDATION_FAILED');
  });
});
