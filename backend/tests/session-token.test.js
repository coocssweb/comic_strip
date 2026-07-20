import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSessionToken, verifySessionToken } from '../src/auth/session-token.js';

const SESSION_SECRET = 'test-session-secret';

test('读者会话令牌只能由读者接口验证', () => {
  const token = createSessionToken({
    subjectId: 'reader-id',
    role: 'reader',
    expiresAt: new Date('2030-01-01T00:00:00.000Z'),
    secret: SESSION_SECRET,
  });

  const readerSession = verifySessionToken({
    token,
    expectedRole: 'reader',
    secret: SESSION_SECRET,
    now: new Date('2029-01-01T00:00:00.000Z'),
  });
  const administratorSession = verifySessionToken({
    token,
    expectedRole: 'admin',
    secret: SESSION_SECRET,
    now: new Date('2029-01-01T00:00:00.000Z'),
  });

  assert.deepEqual(readerSession, {
    subjectId: 'reader-id',
    role: 'reader',
    expiresAt: '2030-01-01T00:00:00.000Z',
  });
  assert.equal(administratorSession, null);
});

test('篡改或过期的会话令牌无法验证', () => {
  const token = createSessionToken({
    subjectId: 'admin',
    role: 'admin',
    expiresAt: new Date('2030-01-01T00:00:00.000Z'),
    secret: SESSION_SECRET,
  });

  assert.equal(
    verifySessionToken({
      token: `${token}tampered`,
      expectedRole: 'admin',
      secret: SESSION_SECRET,
      now: new Date('2029-01-01T00:00:00.000Z'),
    }),
    null,
  );
  assert.equal(
    verifySessionToken({
      token,
      expectedRole: 'admin',
      secret: SESSION_SECRET,
      now: new Date('2031-01-01T00:00:00.000Z'),
    }),
    null,
  );
});

test('相同主体的重复登录会签发不同会话令牌', () => {
  const input = {
    subjectId: 'reader-id',
    role: 'reader',
    expiresAt: new Date('2030-01-01T00:00:00.000Z'),
    secret: SESSION_SECRET,
  };

  assert.notEqual(createSessionToken(input), createSessionToken(input));
});
