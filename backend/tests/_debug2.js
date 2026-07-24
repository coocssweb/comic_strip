process.env.TEST_MONGODB_URI = process.env.TEST_MONGODB_URI || 'mongodb://root:bestwish_123456@110.42.210.230:40123/comic-strip-test?authSource=admin';
process.env.MONGODB_URI = 'mongodb://root:bestwish_123456@110.42.210.230:40123/comic-strip-dev?authSource=admin';
process.env.NODE_ENV = 'test';
process.env.PORT = '0';
process.env.ADMIN_JWT_SECRET = 'test-jwt-secret-at-least-16-chars';
process.env.SECURITY_HMAC_SECRET = 'test-hmac-secret-at-least-16-chars';
process.env.ADMIN_WEB_ORIGIN = 'http://localhost:5173';
process.env.LOG_LEVEL = 'fatal';

console.log('BEFORE IMPORT:', process.env.MONGODB_URI);

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

console.log('AFTER IMPORT:', process.env.MONGODB_URI);

describe('mongo uri test', () => {
  it('should have MONGODB_URI', () => {
    console.log('IN TEST:', process.env.MONGODB_URI);
    assert.ok(process.env.MONGODB_URI);
  });
});
