import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

import { runAdminInit } from '../src/cli/admin-init.js';
import { verifyPassword } from '../src/security/password-hasher.js';
import { openIsolatedTestDatabase } from './helpers/test-mongodb.js';

const TEST_SECRET = randomBytes(32).toString('base64');
const TEST_HMAC_SECRET = randomBytes(32).toString('base64');

describe('CLI admin:init 初始化唯一管理员集成测试', () => {
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

  test('非 TTY 环境下拒绝执行并返回 exitCode 1', async () => {
    let stderrOutput = '';
    const res = await runAdminInit({
      env: testEnv,
      stdin: { isTTY: false },
      stdout: { isTTY: false },
      stderr: { write: (msg) => { stderrOutput += msg; } },
    });

    assert.equal(res.exitCode, 1);
    assert.ok(stderrOutput.includes('只允许在可交互 TTY 终端中运行'));
  });

  test('在干净的数据库中成功初始化唯一管理员', async () => {
    let stdoutOutput = '';
    let stderrOutput = '';
    const prompts = [];
    const promptHandler = async (query, isSecret) => {
      prompts.push({ query, isSecret });
      if (query.includes('登录名')) {
        return '  Primary_Admin.01  ';
      }
      if (query.includes('确认')) {
        return 'ValidSecretPass_12345!';
      }
      return 'ValidSecretPass_12345!';
    };

    const res = await runAdminInit({
      env: testEnv,
      stdin: { isTTY: true },
      stdout: { isTTY: true, write: (msg) => { stdoutOutput += msg; } },
      stderr: { write: (msg) => { stderrOutput += msg; } },
      promptHandler,
    });

    assert.equal(stderrOutput, '', `不应产生错误日志: ${stderrOutput}`);
    assert.equal(res.exitCode, 0);
    assert.equal(res.username, 'primary_admin.01');
    assert.ok(stdoutOutput.includes('唯一管理员初始化成功'));

    const adminDoc = await testDb.connection.db.collection('admins').findOne({ _id: 'primary-admin' });
    assert.ok(adminDoc);
    assert.equal(adminDoc.username, 'primary_admin.01');
    assert.equal(adminDoc.sessionGeneration, 1);
    assert.equal(await verifyPassword(adminDoc.passwordHash, 'ValidSecretPass_12345!'), true);

    const auditDoc = await testDb.connection.db.collection('security_audits').findOne({ eventType: 'ADMIN_INITIALIZATION' });
    assert.ok(auditDoc);
    assert.equal(auditDoc.outcome, 'succeeded');
    assert.equal(auditDoc.actorType, 'trusted_operator');
    assert.equal(auditDoc.adminId, 'primary-admin');
    assert.equal(auditDoc.requestId, res.requestId);
  });

  test('管理员已存在时询问任何凭据前拒绝执行', async () => {
    let stderrOutput = '';
    let prompted = false;

    const res = await runAdminInit({
      env: testEnv,
      stdin: { isTTY: true },
      stdout: { isTTY: true },
      stderr: { write: (msg) => { stderrOutput += msg; } },
      promptHandler: async () => {
        prompted = true;
        return 'anything';
      },
    });

    assert.equal(res.exitCode, 1);
    assert.equal(prompted, false, '已存在管理员时不应进行任何交互询问');
    assert.ok(stderrOutput.includes('唯一管理员已存在'));
  });

  test('数据库 Schema 约束拒绝插入第二个非 primary-admin 的管理员', async () => {
    const adminsCol = testDb.connection.db.collection('admins');
    await assert.rejects(
      () => adminsCol.insertOne({
        _id: 'secondary-admin',
        username: 'secondary',
        passwordHash: 'hash',
        sessionGeneration: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
  });
});
