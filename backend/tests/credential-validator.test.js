import assert from 'node:assert/strict';
import test from 'node:test';

import { validatePassword, validateUsername } from '../src/security/credential-validator.js';

test('validateUsername 接受合法的 3~64 字符规范化登录名', () => {
  assert.equal(validateUsername('  Admin_01.test  '), 'admin_01.test');
  assert.equal(validateUsername('a_b'), 'a_b');
  assert.equal(validateUsername('admin-123'), 'admin-123');
});

test('validateUsername 拒绝非法格式登录名', () => {
  assert.throws(() => validateUsername('ab'), /登录名长度必须在 3 到 64 个字符之间/);
  assert.throws(() => validateUsername('a'.repeat(65)), /登录名长度必须在 3 到 64 个字符之间/);
  assert.throws(() => validateUsername('_admin'), /登录名格式不符合要求/);
  assert.throws(() => validateUsername('admin_'), /登录名格式不符合要求/);
  assert.throws(() => validateUsername('admin@test'), /登录名格式不符合要求/);
  assert.throws(() => validateUsername('admin TEST'), /登录名格式不符合要求/);
});

test('validatePassword 接受 15~128 码点合法密码并转为 NFC 规范化形式', () => {
  const p = 'Password_123456_Valid!';
  assert.equal(validatePassword(p, 'admin_01'), p.normalize('NFC'));
});

test('validatePassword 拒绝短于 15 码点或长于 128 码点的密码', () => {
  assert.throws(() => validatePassword('Short15!', 'admin_01'), /密码长度必须在 15 到 128 个字符之间/);
  assert.throws(() => validatePassword('a'.repeat(129), 'admin_01'), /密码长度必须在 15 到 128 个字符之间/);
});

test('validatePassword 拒绝常见弱密码及包含上下文信息的密码', () => {
  assert.throws(() => validatePassword('password1234567890', 'admin_01'), /密码过于简单/);
  assert.throws(() => validatePassword('admin_01_SuperPassword!', 'admin_01'), /密码不能包含用户名/);
  assert.throws(() => validatePassword('comic-strip-Password123!', 'admin_01'), /密码不能包含/);
  assert.throws(() => validatePassword('apollo.example.com_Secret!', 'admin_01'), /密码不能包含/);
});
