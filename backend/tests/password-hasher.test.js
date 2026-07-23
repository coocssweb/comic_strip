import assert from 'node:assert/strict';
import test from 'node:test';

import { hashPassword, verifyPassword } from '../src/security/password-hasher.js';

test('hashPassword 生成 Argon2id PHC 格式散列，并可以通过 verifyPassword 验证', async () => {
  const password = 'SuperSecret_Password_12345!';
  const phcHash = await hashPassword(password);

  assert.ok(phcHash.startsWith('$argon2id$'));
  assert.ok(phcHash.includes('m=19456'));
  assert.ok(phcHash.includes('t=2'));
  assert.ok(phcHash.includes('p=1'));

  const isValid = await verifyPassword(phcHash, password);
  assert.equal(isValid, true);

  const isInvalid = await verifyPassword(phcHash, 'WrongPassword_12345!');
  assert.equal(isInvalid, false);
});
