const JWT_SECRET = Buffer.from('00112233445566778899aabbccddeefffedcba98765432100123456789abcdef', 'hex');
const HMAC_SECRET = Buffer.from('f0e1d2c3b4a5968778695a4b3c2d1e0f0123456789abcdeffedcba9876543210', 'hex');

export function createTestConfig(overrides = {}) {
  return Object.freeze({
    nodeEnv: 'test',
    port: 0,
    mongoDbUri: 'mongodb://invalid.example.invalid:27017/unreachable',
    adminJwtSecret: Buffer.from(JWT_SECRET),
    securityHmacSecret: Buffer.from(HMAC_SECRET),
    adminWebOrigin: 'http://localhost:4000',
    logLevel: 'info',
    ...overrides,
  });
}
