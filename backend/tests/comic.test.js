process.env.TEST_MONGODB_URI = process.env.TEST_MONGODB_URI || 'mongodb://root:bestwish_123456@110.42.210.230:40123/comic-strip-test?authSource=admin'
process.env.MONGODB_URI = 'mongodb://root:bestwish_123456@110.42.210.230:40123/comic-strip-dev?authSource=admin'
process.env.NODE_ENV = 'test'
process.env.PORT = '0'
process.env.ADMIN_JWT_SECRET = 'test-jwt-secret-at-least-16-chars'
process.env.SECURITY_HMAC_SECRET = 'test-hmac-secret-at-least-16-chars'
process.env.ADMIN_WEB_ORIGIN = 'http://localhost:5173'
process.env.LOG_LEVEL = 'fatal'

import { describe, it, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import argon2 from 'argon2'
import mongoose from 'mongoose'
import { connectTestDb, dropTestDb } from './helpers/test-db.js'
import Admin from '../src/models/admin.model.js'
import Session from '../src/models/session.model.js'
import Comic, { COMIC_STATUS } from '../src/models/comic.model.js'
import { createApp } from '../src/app.js'

console.log('MONGODB_URI after imports:', process.env.MONGODB_URI)

before(async () => {
  console.log('before hook running')
})

describe('smoke', () => {
  it('works', () => {
    assert.ok(process.env.MONGODB_URI)
  })
})
