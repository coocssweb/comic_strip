import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

import { createPrimaryAdmin } from '../src/db/admin-repository.js';
import { createServiceRuntime } from '../src/runtime/service-runtime.js';
import { hashPassword } from '../src/security/password-hasher.js';
import { openIsolatedTestDatabase } from './helpers/test-mongodb.js';

const TEST_SECRET = randomBytes(32).toString('base64');
const TEST_HMAC_SECRET = randomBytes(32).toString('base64');

describe('POST /admin/auth/login 真实 HTTP 登录集成测试', () => {
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

  test('非法 Origin 返回 403 ORIGIN_NOT_ALLOWED 且不暴露 CORS 头', async () => {
    const res = await fetch(`${baseUrl}/admin/auth/login`, {
      method: 'POST',
      headers: { 'Origin': 'http://evil.com', 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'primary_admin', password: 'ValidAdminPassword_12345!' }),
    });

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.code, 'ORIGIN_NOT_ALLOWED');
    assert.equal(res.headers.get('access-control-allow-origin'), null);
  });

  test('非 application/json 返回 415 UNSUPPORTED_MEDIA_TYPE', async () => {
    const res = await fetch(`${baseUrl}/admin/auth/login`, {
      method: 'POST',
      headers: { 'Origin': 'http://localhost:4000', 'Content-Type': 'text/plain' },
      body: 'username=primary_admin',
    });

    assert.equal(res.status, 415);
    const body = await res.json();
    assert.equal(body.code, 'UNSUPPORTED_MEDIA_TYPE');
  });

  test('请求正文包含非法字段返回 400 VALIDATION_ERROR', async () => {
    const res = await fetch(`${baseUrl}/admin/auth/login`, {
      method: 'POST',
      headers: { 'Origin': 'http://localhost:4000', 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'primary_admin', password: 'ValidAdminPassword_12345!', unknownField: true }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.code, 'VALIDATION_ERROR');
  });

  test('错误的登录名或密码返回 401 ADMIN_CREDENTIALS_INVALID', async () => {
    const res = await fetch(`${baseUrl}/admin/auth/login`, {
      method: 'POST',
      headers: { 'Origin': 'http://localhost:4000', 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'primary_admin', password: 'WrongPassword_12345!' }),
    });

    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.code, 'ADMIN_CREDENTIALS_INVALID');
  });

  test('合法凭据登录成功返回 200 OK、Set-Cookie、Cache-Control 及会话结构', async () => {
    const res = await fetch(`${baseUrl}/admin/auth/login`, {
      method: 'POST',
      headers: { 'Origin': 'http://localhost:4000', 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: '  PRIMARY_ADMIN  ', password: 'ValidAdminPassword_12345!' }),
    });

    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.ok(res.headers.get('set-cookie')?.includes('admin_session='));

    const data = await res.json();
    assert.equal(data.admin.id, 'primary-admin');
    assert.equal(data.admin.username, 'primary_admin');
    assert.ok(data.session.idleExpiresAt);
    assert.ok(data.session.absoluteExpiresAt);
    assert.ok(data.serverTime);
    assert.ok(data.csrfToken);

    const sessionDoc = await testDb.connection.db.collection('admin_sessions').findOne({ sessionGeneration: 1 });
    assert.ok(sessionDoc);

    const auditDoc = await testDb.connection.db.collection('security_audits').findOne({ eventType: 'ADMIN_LOGIN', outcome: 'succeeded' });
    assert.ok(auditDoc);
    assert.equal(auditDoc.actorType, 'admin');
  });
});
