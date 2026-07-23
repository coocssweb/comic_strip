import assert from 'node:assert/strict';
import test from 'node:test';

import { loadRuntimeConfig } from '../src/config/runtime-config.js';

const JWT_SECRET_BYTES = Buffer.from('00112233445566778899aabbccddeefffedcba98765432100123456789abcdef', 'hex');
const HMAC_SECRET_BYTES = Buffer.from('f0e1d2c3b4a5968778695a4b3c2d1e0f0123456789abcdeffedcba9876543210', 'hex');
const JWT_SECRET = JWT_SECRET_BYTES.toString('base64');
const HMAC_SECRET = HMAC_SECRET_BYTES.toString('base64');

function validEnvironment(overrides = {}) {
  return {
    NODE_ENV: 'development',
    MONGODB_URI: 'mongodb://127.0.0.1:27017/comic_strip',
    ADMIN_JWT_SECRET: JWT_SECRET,
    SECURITY_HMAC_SECRET: HMAC_SECRET,
    ADMIN_WEB_ORIGIN: 'http://localhost:4000',
    ...overrides,
  };
}

test('开发环境使用固定默认端口和日志级别', () => {
  const config = loadRuntimeConfig(validEnvironment());

  assert.equal(config.port, 40001);
  assert.equal(config.logLevel, 'info');
  assert(Object.isFrozen(config));
});

test('测试环境允许随机端口', () => {
  const config = loadRuntimeConfig(validEnvironment({ NODE_ENV: 'test', PORT: '0' }));

  assert.equal(config.port, 0);
});

test('只读取白名单配置且忽略无关环境变量', () => {
  const config = loadRuntimeConfig(validEnvironment({ PATH: 'ignored', UNRELATED_SECRET: 'ignored' }));

  assert.equal('PATH' in config, false);
  assert.equal('UNRELATED_SECRET' in config, false);
});

test('安全秘密只以解码后的 Buffer 暴露', () => {
  const config = loadRuntimeConfig(validEnvironment());

  assert(Buffer.isBuffer(config.adminJwtSecret));
  assert(Buffer.isBuffer(config.securityHmacSecret));
  assert.equal(config.adminJwtSecret.equals(JWT_SECRET_BYTES), true);
  assert.equal(config.securityHmacSecret.equals(HMAC_SECRET_BYTES), true);
});

for (const [label, encode] of [
  ['Base64 有 padding', (value) => value.toString('base64')],
  ['Base64 无 padding', (value) => value.toString('base64').replace(/=+$/, '')],
  ['Base64URL 有 padding', (value) => `${value.toString('base64url')}=`],
  ['Base64URL 无 padding', (value) => value.toString('base64url')],
]) {
  test(`接受严格可往返的 ${label} 安全秘密`, () => {
    const secretBytes = Buffer.from('fb112233445566778899aabbccddeeff102132435465768798a9bacbdcedfe0f', 'hex');
    const config = loadRuntimeConfig(validEnvironment({ ADMIN_JWT_SECRET: encode(secretBytes) }));

    assert.equal(config.adminJwtSecret.equals(secretBytes), true);
  });
}

for (const nodeEnv of ['', 'staging']) {
  test(`拒绝 NODE_ENV=${JSON.stringify(nodeEnv)}`, () => {
    assert.throws(() => loadRuntimeConfig(validEnvironment({ NODE_ENV: nodeEnv })), /运行环境/);
  });
}

for (const port of ['-1', '65536', '1.5', 'not-a-port']) {
  test(`拒绝非法端口 ${port}`, () => {
    assert.throws(() => loadRuntimeConfig(validEnvironment({ PORT: port })), /端口/);
  });
}

test('生产和测试环境必须显式提供端口', () => {
  assert.throws(
    () => loadRuntimeConfig(validEnvironment({ NODE_ENV: 'production', PORT: undefined, ADMIN_WEB_ORIGIN: 'https://apollo.example.com' })),
    /端口/,
  );
});

for (const mongoDbUri of [
  '',
  'http://127.0.0.1:27017/comic_strip',
  'mongodb://127.0.0.1:27017',
  'mongodb://127.0.0.1:27017/',
]) {
  test('拒绝不含数据库名的完整 MongoDB URI', () => {
    assert.throws(() => loadRuntimeConfig(validEnvironment({ MONGODB_URI: mongoDbUri })), /数据库连接配置/);
  });
}

test('拒绝弱安全秘密', () => {
  assert.throws(
    () => loadRuntimeConfig(validEnvironment({ ADMIN_JWT_SECRET: Buffer.alloc(31).toString('base64') })),
    /JWT 安全秘密/,
  );
});

for (const [label, weakSecret] of [
  ['全零字节', Buffer.alloc(32)],
  ['短字节模式循环', Buffer.from(Array.from({ length: 32 }, (_, index) => [1, 2, 3, 4][index % 4]))],
  ['重复人类短语', Buffer.from('password'.repeat(4), 'utf8')],
]) {
  test(`拒绝${label}组成的明显弱安全秘密`, () => {
    assert.throws(
      () => loadRuntimeConfig(validEnvironment({ ADMIN_JWT_SECRET: weakSecret.toString('base64') })),
      /JWT 安全秘密强度不足/,
    );
  });
}

test('拒绝无法规范解码的安全秘密', () => {
  assert.throws(() => loadRuntimeConfig(validEnvironment({ ADMIN_JWT_SECRET: 'not-base64!' })), /JWT 安全秘密/);
});

test('拒绝相同的安全秘密', () => {
  assert.throws(
    () => loadRuntimeConfig(validEnvironment({ SECURITY_HMAC_SECRET: JWT_SECRET })),
    /安全秘密不能相同/,
  );
});

test('开发环境管理端来源必须固定', () => {
  assert.throws(
    () => loadRuntimeConfig(validEnvironment({ ADMIN_WEB_ORIGIN: 'http://localhost:4001' })),
    /管理端来源/,
  );
});

test('生产环境管理端来源必须固定', () => {
  assert.throws(
    () => loadRuntimeConfig(validEnvironment({
      NODE_ENV: 'production',
      PORT: '40001',
      ADMIN_WEB_ORIGIN: 'http://localhost:4000',
    })),
    /管理端来源/,
  );
});

test('拒绝非法日志级别', () => {
  assert.throws(() => loadRuntimeConfig(validEnvironment({ LOG_LEVEL: 'verbose' })), /日志级别/);
});

test('错误信息不包含秘密或数据库 URI', () => {
  const unsafeUri = 'mongodb://admin:password@127.0.0.1:27017/';
  let error;

  try {
    loadRuntimeConfig(validEnvironment({ MONGODB_URI: unsafeUri }));
  } catch (caughtError) {
    error = caughtError;
  }

  assert(error instanceof Error);
  assert.equal(error.message.includes(unsafeUri), false);
  assert.equal(error.message.includes('password'), false);
  assert.equal(error.message.includes(JWT_SECRET), false);
});

test('数据库名编码非法时仍返回稳定中文摘要', () => {
  assert.throws(
    () => loadRuntimeConfig(validEnvironment({ MONGODB_URI: 'mongodb://127.0.0.1:27017/%' })),
    /数据库连接配置格式错误/,
  );
});
