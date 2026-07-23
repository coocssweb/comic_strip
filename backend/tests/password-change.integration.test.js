import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

import { createPrimaryAdmin } from '../src/db/admin-repository.js';
import { createServiceRuntime } from '../src/runtime/service-runtime.js';
import { hashPassword } from '../src/security/password-hasher.js';
import { openIsolatedTestDatabase } from './helpers/test-mongodb.js';

const TEST_SECRET = randomBytes(32).toString('base64');
const TEST_HMAC_SECRET = randomBytes(32).toString('base64');

describe('PATCH /admin/auth/password 修改密码与全会话撤销集成测试', () => {
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

  test('当前密码错误时返回 403 CURRENT_PASSWORD_INVALID', async () => {
    const loginRes = await fetch(`${baseUrl}/admin/auth/login`, {
      method: 'POST',
      headers: { 'Origin': 'http://localhost:4000', 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'primary_admin', password: 'ValidAdminPassword_12345!' }),
    });
    const cookie = loginRes.headers.get('set-cookie');
    const { csrfToken } = await loginRes.json();

    const res = await fetch(`${baseUrl}/admin/auth/password`, {
      method: 'PATCH',
      headers: { 'Origin': 'http://localhost:4000', 'Cookie': cookie, 'X-CSRF-Token': csrfToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: 'WrongPassword_12345!', newPassword: 'NewValidAdminPassword_9999!' }),
    });

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.code, 'CURRENT_PASSWORD_INVALID');
  });

  test('新密码与当前密码相同时返回 409 ADMIN_CREDENTIAL_UNCHANGED', async () => {
    const loginRes = await fetch(`${baseUrl}/admin/auth/login`, {
      method: 'POST',
      headers: { 'Origin': 'http://localhost:4000', 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'primary_admin', password: 'ValidAdminPassword_12345!' }),
    });
    const cookie = loginRes.headers.get('set-cookie');
    const { csrfToken } = await loginRes.json();

    const res = await fetch(`${baseUrl}/admin/auth/password`, {
      method: 'PATCH',
      headers: { 'Origin': 'http://localhost:4000', 'Cookie': cookie, 'X-CSRF-Token': csrfToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: 'ValidAdminPassword_12345!', newPassword: 'ValidAdminPassword_12345!' }),
    });

    assert.equal(res.status, 409);
    const body = await res.json();
    assert.equal(body.code, 'ADMIN_CREDENTIAL_UNCHANGED');
  });

  test('正确修改密码原子递增世代并使所有旧会话即时失效', async () => {
    // 建立旧会话 A 和 B
    const loginA = await fetch(`${baseUrl}/admin/auth/login`, {
      method: 'POST',
      headers: { 'Origin': 'http://localhost:4000', 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'primary_admin', password: 'ValidAdminPassword_12345!' }),
    });
    const cookieA = loginA.headers.get('set-cookie');
    const { csrfToken: csrfA } = await loginA.json();

    const loginB = await fetch(`${baseUrl}/admin/auth/login`, {
      method: 'POST',
      headers: { 'Origin': 'http://localhost:4000', 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'primary_admin', password: 'ValidAdminPassword_12345!' }),
    });
    const cookieB = loginB.headers.get('set-cookie');

    // 通过会话 A 发起密码修改
    const patchRes = await fetch(`${baseUrl}/admin/auth/password`, {
      method: 'PATCH',
      headers: { 'Origin': 'http://localhost:4000', 'Cookie': cookieA, 'X-CSRF-Token': csrfA, 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: 'ValidAdminPassword_12345!', newPassword: 'BrandNewPassword_88888!' }),
    });

    assert.equal(patchRes.status, 204);
    assert.ok(patchRes.headers.get('set-cookie')?.includes('admin_session=;'));

    // 验证会话 A 和会话 B 均由于 sessionGeneration 失配而即时失效 (401)
    const checkA = await fetch(`${baseUrl}/admin/auth/session`, {
      headers: { 'Origin': 'http://localhost:4000', 'Cookie': cookieA },
    });
    assert.equal(checkA.status, 401);

    const checkB = await fetch(`${baseUrl}/admin/auth/session`, {
      headers: { 'Origin': 'http://localhost:4000', 'Cookie': cookieB },
    });
    assert.equal(checkB.status, 401);

    // 旧密码登录失败
    const oldLogin = await fetch(`${baseUrl}/admin/auth/login`, {
      method: 'POST',
      headers: { 'Origin': 'http://localhost:4000', 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'primary_admin', password: 'ValidAdminPassword_12345!' }),
    });
    assert.equal(oldLogin.status, 401);

    // 新密码登录成功
    const newLogin = await fetch(`${baseUrl}/admin/auth/login`, {
      method: 'POST',
      headers: { 'Origin': 'http://localhost:4000', 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'primary_admin', password: 'BrandNewPassword_88888!' }),
    });
    assert.equal(newLogin.status, 200);

    const adminDoc = await testDb.connection.db.collection('admins').findOne({ _id: 'primary-admin' });
    assert.equal(adminDoc.sessionGeneration, 2);

    const auditPass = await testDb.connection.db.collection('security_audits').findOne({ eventType: 'ADMIN_PASSWORD_CHANGE', outcome: 'succeeded' });
    assert.ok(auditPass);
    const auditRevocation = await testDb.connection.db.collection('security_audits').findOne({ eventType: 'ADMIN_SESSION_REVOCATION', outcome: 'succeeded' });
    assert.ok(auditRevocation);
  });
});
