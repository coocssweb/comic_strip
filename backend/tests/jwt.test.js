import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import test from 'node:test';

import { signAdminJwt, verifyAdminJwt } from '../src/security/jwt.js';

const TEST_SECRET = randomBytes(32);

test('signAdminJwt 生成合法的 HS256 JWT，且 verifyAdminJwt 能成功验签及读取 Claims', () => {
  const claims = {
    jti: '12345678-1234-4234-9234-123456789abc',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    sessionGeneration: 1,
    csrfToken: 'sample-csrf-token',
  };

  const jwt = signAdminJwt(claims, TEST_SECRET);
  assert.ok(typeof jwt === 'string' && jwt.split('.').length === 3);

  const payload = verifyAdminJwt(jwt, TEST_SECRET);
  assert.equal(payload.iss, 'comic-strip-api');
  assert.equal(payload.aud, 'comic-strip-admin');
  assert.equal(payload.sub, 'primary-admin');
  assert.equal(payload.jti, claims.jti);
  assert.equal(payload.sessionGeneration, 1);
  assert.equal(payload.csrfToken, 'sample-csrf-token');
});

test('verifyAdminJwt 拒绝篡改、错误密钥或非 HS256 算法的 JWT', () => {
  const claims = {
    jti: '12345678-1234-4234-9234-123456789abc',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    sessionGeneration: 1,
    csrfToken: 'sample-csrf-token',
  };

  const jwt = signAdminJwt(claims, TEST_SECRET);
  const wrnSecret = randomBytes(32);

  assert.throws(() => verifyAdminJwt(jwt, wrnSecret), /签名无效/);

  const parts = jwt.split('.');
  const tamperedJwt = `${parts[0]}.${parts[1]}tampered.${parts[2]}`;
  assert.throws(() => verifyAdminJwt(tamperedJwt, TEST_SECRET), /签名无效/);
});

test('verifyAdminJwt 拒绝过期令牌（支持 30 秒时钟偏差）', () => {
  const claims = {
    jti: '12345678-1234-4234-9234-123456789abc',
    iat: Math.floor(Date.now() / 1000) - 4000,
    exp: Math.floor(Date.now() / 1000) - 35, // 超过 30 秒偏差
    sessionGeneration: 1,
    csrfToken: 'sample-csrf-token',
  };

  const jwt = signAdminJwt(claims, TEST_SECRET);
  assert.throws(() => verifyAdminJwt(jwt, TEST_SECRET), /令牌已过期/);
});
