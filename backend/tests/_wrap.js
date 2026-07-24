process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
process.env.NODE_ENV = 'test';
process.env.PORT = '0';
process.env.ADMIN_JWT_SECRET = 'test-jwt-secret-at-least-16-chars';
process.env.SECURITY_HMAC_SECRET = 'test-hmac-secret-at-least-16-chars';
process.env.ADMIN_WEB_ORIGIN = 'http://localhost:5173';
process.env.LOG_LEVEL = 'fatal';

import './tests/comic.test.js';
