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

const TEST_PASSWORD = 'TestPassword123!'
const TEST_USERNAME = 'admin-comic-test'

let dbName
let baseUrl
let server
let adminCookie

async function loginAsAdmin() {
  const res = await fetch(baseUrl + '/admin/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: TEST_USERNAME, password: TEST_PASSWORD }),
  })
  return res.headers.getSetCookie().join('; ')
}

async function createDraftComic(cookie, overrides = {}) {
  const body = { title: 'Test-' + Date.now(), tags: ['scifi', 'action'], ...overrides }
  const res = await fetch(baseUrl + '/api/v1/comics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify(body),
  })
  return { res, body: await res.json() }
}

before(async () => {
  dbName = await connectTestDb()

  const passwordHash = await argon2.hash(TEST_PASSWORD)
  await Admin.create({ username: TEST_USERNAME, passwordHash })

  const created = createApp()
  await new Promise((resolve) => {
    server = created.app.listen(0, () => {
      baseUrl = 'http://127.0.0.1:' + server.address().port
      resolve()
    })
  })

  adminCookie = await loginAsAdmin()
})

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve))
  await dropTestDb(dbName)
})

beforeEach(async () => {
  await Comic.deleteMany({})
})

describe('POST /api/v1/comics', () => {
  it('admin creates draft comic returns 201', async () => {
    const res = await fetch(baseUrl + '/api/v1/comics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ title: 'My First Comic', tags: ['scifi'] }),
    })
    assert.equal(res.status, 201)
    const body = await res.json()
    assert.ok(body._id)
    assert.equal(body.title, 'My First Comic')
    assert.equal(body.status, COMIC_STATUS.DRAFT)
    assert.deepStrictEqual(body.tags, ['scifi'])
    assert.equal(body.likeCount, 0)
    assert.equal(body.favoriteCount, 0)
    assert.equal(body.commentCount, 0)
    assert.equal(body.publishedAt, null)
    assert.ok(body.createdAt)
    assert.ok(body.updatedAt)
  })

  it('default status is draft', async () => {
    const { body } = await createDraftComic(adminCookie)
    assert.equal(body.status, COMIC_STATUS.DRAFT)
  })

  it('seriesId defaults to null', async () => {
    const { body } = await createDraftComic(adminCookie)
    assert.equal(body.seriesId, null)
  })

  it('seriesId can be set', async () => {
    const { body } = await createDraftComic(adminCookie, { seriesId: 'series-001' })
    assert.equal(body.seriesId, 'series-001')
  })

  it('tags defaults to empty array', async () => {
    const { body } = await createDraftComic(adminCookie, { tags: undefined })
    assert.deepStrictEqual(body.tags, [])
  })

  it('unauthenticated returns 401', async () => {
    const res = await fetch(baseUrl + '/api/v1/comics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'No Auth' }),
    })
    assert.equal(res.status, 401)
    assert.equal((await res.json()).code, 'ADMIN_AUTH_REQUIRED')
  })

  it('empty title returns 400', async () => {
    const res = await fetch(baseUrl + '/api/v1/comics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ title: '' }),
    })
    assert.equal(res.status, 400)
    assert.equal((await res.json()).code, 'VALIDATION_ERROR')
  })

  it('title over 100 chars returns 400', async () => {
    const res = await fetch(baseUrl + '/api/v1/comics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ title: 'a'.repeat(101) }),
    })
    assert.equal(res.status, 400)
    assert.equal((await res.json()).code, 'VALIDATION_ERROR')
  })
})

describe('GET /api/v1/comics', () => {
  beforeEach(async () => {
    await Comic.create([
      { title: 'Pub A', status: COMIC_STATUS.PUBLISHED, tags: ['scifi'], publishedAt: new Date() },
      { title: 'Pub B', status: COMIC_STATUS.PUBLISHED, tags: ['action'], publishedAt: new Date() },
      { title: 'Draft C', status: COMIC_STATUS.DRAFT, tags: ['scifi'] },
      { title: 'Unpub D', status: COMIC_STATUS.UNPUBLISHED, tags: ['action'] },
    ])
  })

  it('public only sees published comics', async () => {
    const res = await fetch(baseUrl + '/api/v1/comics')
    const body = await res.json()
    assert.equal(body.items.length, 2)
    for (const item of body.items) {
      assert.equal(item.status, COMIC_STATUS.PUBLISHED)
    }
  })

  it('returns pagination info', async () => {
    const res = await fetch(baseUrl + '/api/v1/comics')
    const body = await res.json()
    assert.equal(body.total, 2)
    assert.equal(body.page, 1)
    assert.equal(body.pageSize, 20)
  })

  it('admin with status=draft filters drafts', async () => {
    const res = await fetch(baseUrl + '/api/v1/comics?status=draft', {
      headers: { Cookie: adminCookie },
    })
    const body = await res.json()
    assert.equal(body.items.length, 1)
    assert.equal(body.items[0].title, 'Draft C')
  })

  it('admin without status sees all', async () => {
    const res = await fetch(baseUrl + '/api/v1/comics', {
      headers: { Cookie: adminCookie },
    })
    const body = await res.json()
    assert.equal(body.items.length, 4)
  })

  it('supports seriesId filter', async () => {
    await Comic.create({ title: 'Series Comic', status: COMIC_STATUS.PUBLISHED, seriesId: 's1', publishedAt: new Date() })
    const res = await fetch(baseUrl + '/api/v1/comics?seriesId=s1')
    const body = await res.json()
    assert.equal(body.items.length, 1)
    assert.equal(body.items[0].title, 'Series Comic')
  })

  it('supports tag filter', async () => {
    const res = await fetch(baseUrl + '/api/v1/comics?tag=action')
    const body = await res.json()
    assert.equal(body.items.length, 1)
    assert.equal(body.items[0].title, 'Pub B')
  })

  it('supports page + pageSize', async () => {
    const res = await fetch(baseUrl + '/api/v1/comics?page=1&pageSize=1')
    const body = await res.json()
    assert.equal(body.items.length, 1)
    assert.equal(body.total, 2)
    assert.equal(body.page, 1)
    assert.equal(body.pageSize, 1)
  })
})

describe('GET /api/v1/comics/:id', () => {
  let publishedId
  let draftId

  beforeEach(async () => {
    const published = await Comic.create({ title: 'Published One', status: COMIC_STATUS.PUBLISHED, publishedAt: new Date() })
    const draft = await Comic.create({ title: 'Draft One', status: COMIC_STATUS.DRAFT })
    publishedId = published._id
    draftId = draft._id
  })

  it('public can view published comic', async () => {
    const res = await fetch(baseUrl + '/api/v1/comics/' + publishedId)
    assert.equal(res.status, 200)
    assert.equal((await res.json())._id, publishedId)
  })

  it('public gets 404 for non-published comic', async () => {
    const res = await fetch(baseUrl + '/api/v1/comics/' + draftId)
    assert.equal(res.status, 404)
    assert.equal((await res.json()).code, 'COMIC_NOT_FOUND')
  })

  it('admin can view draft comic', async () => {
    const res = await fetch(baseUrl + '/api/v1/comics/' + draftId, {
      headers: { Cookie: adminCookie },
    })
    assert.equal(res.status, 200)
    assert.equal((await res.json()).status, COMIC_STATUS.DRAFT)
  })

  it('non-existent id returns 404', async () => {
    const res = await fetch(baseUrl + '/api/v1/comics/ffffffff-ffff-ffff-ffff-ffffffffffff')
    assert.equal(res.status, 404)
    assert.equal((await res.json()).code, 'COMIC_NOT_FOUND')
  })
})

describe('PUT /api/v1/comics/:id', () => {
  let comicId

  beforeEach(async () => {
    const comic = await Comic.create({ title: 'Original', status: COMIC_STATUS.DRAFT, tags: ['scifi'] })
    comicId = comic._id
  })

  it('admin updates title', async () => {
    const res = await fetch(baseUrl + '/api/v1/comics/' + comicId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ title: 'New Title' }),
    })
    assert.equal(res.status, 200)
    assert.equal((await res.json()).title, 'New Title')
  })

  it('admin updates tags', async () => {
    const res = await fetch(baseUrl + '/api/v1/comics/' + comicId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ tags: ['action', 'adventure'] }),
    })
    assert.equal(res.status, 200)
    assert.deepStrictEqual((await res.json()).tags, ['action', 'adventure'])
  })

  it('admin updates seriesId', async () => {
    const res = await fetch(baseUrl + '/api/v1/comics/' + comicId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ seriesId: 'series-new' }),
    })
    assert.equal(res.status, 200)
    assert.equal((await res.json()).seriesId, 'series-new')
  })

  it('unauthenticated returns 401', async () => {
    const res = await fetch(baseUrl + '/api/v1/comics/' + comicId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Hack' }),
    })
    assert.equal(res.status, 401)
  })

  it('non-existent comic returns 404', async () => {
    const res = await fetch(baseUrl + '/api/v1/comics/ffffffff-ffff-ffff-ffff-ffffffffffff', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ title: 'Ghost' }),
    })
    assert.equal(res.status, 404)
    assert.equal((await res.json()).code, 'COMIC_NOT_FOUND')
  })

  it('empty body returns 400', async () => {
    const res = await fetch(baseUrl + '/api/v1/comics/' + comicId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({}),
    })
    assert.equal(res.status, 400)
    assert.equal((await res.json()).code, 'VALIDATION_ERROR')
  })

  it('status field is ignored in update', async () => {
    const res = await fetch(baseUrl + '/api/v1/comics/' + comicId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ title: 'Try status', status: 'published' }),
    })
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.status, COMIC_STATUS.DRAFT)
    assert.equal(body.title, 'Try status')
  })
})

describe('error response format', () => {
  it('error body has code, message, requestId', async () => {
    const res = await fetch(baseUrl + '/api/v1/comics/ffffffff-ffff-ffff-ffff-ffffffffffff')
    assert.ok(res.status >= 400)
    const body = await res.json()
    assert.ok('code' in body)
    assert.ok('message' in body)
    assert.ok('requestId' in body)
  })
})
