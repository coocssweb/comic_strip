import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

import { runAdminRecover } from '../src/cli/admin-recover.js';
import { createPrimaryAdmin } from '../src/db/admin-repository.js';
import { createServiceRuntime } from '../src/runtime/service-runtime.js';
import { hashPassword } from '../src/security/password-hasher.js';
import { openIsolatedTestDatabase } from './helpers/test-mongodb.js';

const TEST_SECRET = randomBytes(32).toString('base64');
const TEST_HMAC_SECRET = randomBytes(32).toString('base64');

function createOutputBuffer(isTTY = true) {
  let output = '';
  return {
    isTTY,
    write: (msg) => { output += msg; },
    getOutput: () => output,
  };
}

describe('admin:recover CLI 管理员访问恢复集成测试', () => {
  let testDb;
  let testEnv;

  before(async () => {
    testDb = await openIsolatedTestDatabase();
    testEnv = {
      NODE_ENV: 'test',
      PORT: '0',
      MONGODB_URI: testDb.uri,
      ADMIN_JWT_SECRET: TEST_SECRET,
      SECURITY_HMAC_SECRET: TEST_HMAC_SECRET,
      ADMIN_WEB_ORIGIN: 'http://localhost:4000',
    };
  });

  after(async () => {
    if (testDb) {
      await testDb.dropAndClose();
    }
  });

  test('非 TTY 环境运行拒绝并返回退出码 1', async () => {
    const stdout = createOutputBuffer(false);
    const stderr = createOutputBuffer(false);

    const result = await runAdminRecover({
      env: testEnv,
      stdin: { isTTY: false },
      stdout,
      stderr,
    });

    assert.equal(result.exitCode, 1);
    assert.ok(stderr.getOutput().includes('只允许在可交互 TTY 终端中运行'));
  });

  test('管理员未初始化时恢复失败并记录失败审计', async () => {
    const stdout = createOutputBuffer(true);
    const stderr = createOutputBuffer(true);

    const result = await runAdminRecover({
      env: testEnv,
      stdin: { isTTY: true },
      stdout,
      stderr,
    });

    assert.equal(result.exitCode, 1);
    assert.ok(stderr.getOutput().includes('唯一管理员尚未初始化'));

    const audit = await testDb.connection.db.collection('security_audits').findOne({ eventType: 'ADMIN_ACCESS_RECOVERY', outcome: 'failed' });
    assert.ok(audit);
  });

  test('成功恢复修改登录名与密码并即时撤销旧管理会话', async () => {
    // 1. 先初始化管理员与 HTTP 服务
    const passHash = await hashPassword('InitialAdminPassword_12345!');
    await createPrimaryAdmin(testDb.connection.db, {
      username: 'initial_admin',
      passwordHash: passHash,
    });

    const runtime = createServiceRuntime({ env: testEnv });
    const address = await runtime.start();
    const baseUrl = `http://127.0.0.1:${address.port}`;

    // 2. 登录建立旧会话
    const loginRes = await fetch(`${baseUrl}/admin/auth/login`, {
      method: 'POST',
      headers: { 'Origin': 'http://localhost:4000', 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'initial_admin', password: 'InitialAdminPassword_12345!' }),
    });
    const oldCookie = loginRes.headers.get('set-cookie');
    assert.equal(loginRes.status, 200);

    // 3. 执行 CLI 恢复
    const stdout = createOutputBuffer(true);
    const stderr = createOutputBuffer(true);

    const prompts = [
      'recovered_admin',               // 新登录名
      'RecoveredAdminPassword_9999!',   // 新密码
      'RecoveredAdminPassword_9999!',   // 确认密码
      'RECOVER',                        // 确认短语
    ];
    let promptIndex = 0;

    const result = await runAdminRecover({
      env: testEnv,
      stdin: { isTTY: true },
      stdout,
      stderr,
      promptHandler: async () => prompts[promptIndex++],
    });

    assert.equal(result.exitCode, 0);
    assert.equal(result.username, 'recovered_admin');
    assert.ok(stdout.getOutput().includes('管理员访问已成功恢复'));

    // 4. 验证旧会话访问已由于世代递增被拒绝 (401)
    const checkRes = await fetch(`${baseUrl}/admin/auth/session`, {
      headers: { 'Origin': 'http://localhost:4000', 'Cookie': oldCookie },
    });
    assert.equal(checkRes.status, 401);

    // 5. 验证新凭据可正常登录
    const newLoginRes = await fetch(`${baseUrl}/admin/auth/login`, {
      method: 'POST',
      headers: { 'Origin': 'http://localhost:4000', 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'recovered_admin', password: 'RecoveredAdminPassword_9999!' }),
    });
    assert.equal(newLoginRes.status, 200);

    await runtime.shutdown();
  });
});
