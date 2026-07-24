// 连载集成测试 — 覆盖 Series CRUD + 生命周期管理全部端点

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
import { connectTestDb, dropTestDb } from './helpers/test-db.js'
import Admin from '../src/models/admin.model.js'
import Comic, { COMIC_STATUS } from '../src/models/comic.model.js'
import Series, { SERIES_STATUS } from '../src/models/series.model.js'
import { createApp } from '../src/app.js'

const TEST_PASSWORD = 'TestPassword123!'
const TEST_USERNAME = 'admin-series-test'

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

/** 创建测试用漫画，返回 lean 对象 */
async function createTestComic(overrides = {}) {
  const comic = await Comic.create({
    title: 'Test Comic ' + Date.now(),
    status: COMIC_STATUS.PUBLISHED,
    cover: 'covers/test-cover.jpg',
    publishedAt: new Date(),
    ...overrides,
  })
  return comic
}

/** 通过 API 创建连载 */
async function createSeriesViaApi(cookie, body) {
  const res = await fetch(baseUrl + '/api/v1/series', {
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
  await Series.deleteMany({})
  await Comic.deleteMany({})
})

describe('POST /api/v1/series', () => {
  it('admin creates draft series returns 201', async () => {
    const { res, body } = await createSeriesViaApi(adminCookie, {
      title: 'My First Series',
    })
    assert.equal(res.status, 201)
    assert.ok(body._id)
    assert.equal(body.title, 'My First Series')
    assert.equal(body.status, SERIES_STATUS.DRAFT)
    assert.equal(body.isCompleted, false)
    assert.deepStrictEqual(body.comics, [])
    assert.equal(body.publishedAt, null)
    assert.ok(body.createdAt)
    assert.ok(body.updatedAt)
  })

  it('default status is draft', async () => {
    const { body } = await createSeriesViaApi(adminCookie, { title: 'Draft Test' })
    assert.equal(body.status, SERIES_STATUS.DRAFT)
  })

  it('default isCompleted is false', async () => {
    const { body } = await createSeriesViaApi(adminCookie, { title: 'Not Completed' })
    assert.equal(body.isCompleted, false)
  })

  it('can set isCompleted to true', async () => {
    const { body } = await createSeriesViaApi(adminCookie, {
      title: 'Completed Series',
      isCompleted: true,
    })
    assert.equal(body.isCompleted, true)
  })

  it('can create with member comics', async () => {
    const c1 = await createTestComic()
    const c2 = await createTestComic()
    const { body } = await createSeriesViaApi(adminCookie, {
      title: 'Series with Comics',
      comics: [
        { comicId: c1._id, order: 0 },
        { comicId: c2._id, order: 1 },
      ],
    })
    assert.equal(body.comics.length, 2)
  })

  it('unauthenticated returns 401', async () => {
    const res = await fetch(baseUrl + '/api/v1/series', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'No Auth' }),
    })
    assert.equal(res.status, 401)
    assert.equal((await res.json()).code, 'ADMIN_AUTH_REQUIRED')
  })

  it('empty title returns 400', async () => {
    const res = await fetch(baseUrl + '/api/v1/series', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ title: '' }),
    })
    assert.equal(res.status, 400)
    assert.equal((await res.json()).code, 'VALIDATION_ERROR')
  })

  it('title over 100 chars returns 400', async () => {
    const res = await fetch(baseUrl + '/api/v1/series', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ title: 'a'.repeat(101) }),
    })
    assert.equal(res.status, 400)
    assert.equal((await res.json()).code, 'VALIDATION_ERROR')
  })

  it('duplicate member comic returns 409 SERIES_DUPLICATE_COMIC', async () => {
    const c1 = await createTestComic()
    const { res, body } = await createSeriesViaApi(adminCookie, {
      title: 'Dup Comics',
      comics: [
        { comicId: c1._id, order: 0 },
        { comicId: c1._id, order: 1 },
      ],
    })
    assert.equal(res.status, 409)
    assert.equal(body.code, 'SERIES_DUPLICATE_COMIC')
  })

  it('non-existent member comic returns 400 SERIES_COMIC_NOT_FOUND', async () => {
    const { res, body } = await createSeriesViaApi(adminCookie, {
      title: 'Ghost Comic',
      comics: [{ comicId: 'ffffffff-ffff-ffff-ffff-ffffffffffff', order: 0 }],
    })
    assert.equal(res.status, 400)
    assert.equal(body.code, 'SERIES_COMIC_NOT_FOUND')
  })

  it('comic already in another series returns 409 COMIC_ALREADY_IN_SERIES', async () => {
    const c1 = await createTestComic()
    // 先把漫画加入第一个连载
    await createSeriesViaApi(adminCookie, {
      title: 'First Series',
      comics: [{ comicId: c1._id, order: 0 }],
    })
    // 再尝试把它加入第二个连载
    const { res, body } = await createSeriesViaApi(adminCookie, {
      title: 'Second Series',
      comics: [{ comicId: c1._id, order: 0 }],
    })
    assert.equal(res.status, 409)
    assert.equal(body.code, 'COMIC_ALREADY_IN_SERIES')
  })
})

describe('GET /api/v1/series', () => {
  beforeEach(async () => {
    await Series.create([
      { title: 'Pub A', status: SERIES_STATUS.PUBLISHED, publishedAt: new Date() },
      { title: 'Pub B', status: SERIES_STATUS.PUBLISHED, publishedAt: new Date() },
      { title: 'Draft C', status: SERIES_STATUS.DRAFT },
      { title: 'Unpub D', status: SERIES_STATUS.UNPUBLISHED },
    ])
  })

  it('public only sees published series', async () => {
    const res = await fetch(baseUrl + '/api/v1/series')
    const body = await res.json()
    assert.equal(body.items.length, 2)
    for (const item of body.items) {
      assert.equal(item.status, SERIES_STATUS.PUBLISHED)
    }
  })

  it('returns pagination info', async () => {
    const res = await fetch(baseUrl + '/api/v1/series')
    const body = await res.json()
    assert.equal(body.total, 2)
    assert.equal(body.page, 1)
    assert.equal(body.pageSize, 20)
  })

  it('admin with status=draft filters drafts', async () => {
    const res = await fetch(baseUrl + '/api/v1/series?status=draft', {
      headers: { Cookie: adminCookie },
    })
    const body = await res.json()
    assert.equal(body.items.length, 1)
    assert.equal(body.items[0].title, 'Draft C')
  })

  it('admin without status sees all', async () => {
    const res = await fetch(baseUrl + '/api/v1/series', {
      headers: { Cookie: adminCookie },
    })
    const body = await res.json()
    assert.equal(body.items.length, 4)
  })

  it('supports page + pageSize', async () => {
    const res = await fetch(baseUrl + '/api/v1/series?page=1&pageSize=1')
    const body = await res.json()
    assert.equal(body.items.length, 1)
    assert.equal(body.total, 2)
    assert.equal(body.page, 1)
    assert.equal(body.pageSize, 1)
  })
})

describe('GET /api/v1/series/:id', () => {
  let publishedId
  let draftId
  let comic1Id
  let comic2Id

  beforeEach(async () => {
    const c1 = await createTestComic()
    const c2 = await createTestComic()
    comic1Id = c1._id
    comic2Id = c2._id

    const published = await Series.create({
      title: 'Published Series',
      status: SERIES_STATUS.PUBLISHED,
      publishedAt: new Date(),
      comics: [
        { comicId: comic1Id, order: 1 },
        { comicId: comic2Id, order: 0 },
      ],
    })
    const draft = await Series.create({
      title: 'Draft Series',
      status: SERIES_STATUS.DRAFT,
    })
    publishedId = published._id
    draftId = draft._id
  })

  it('public can view published series with expanded comics', async () => {
    const res = await fetch(baseUrl + '/api/v1/series/' + publishedId)
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body._id, publishedId)
    assert.equal(body.comics.length, 2)
    // 按 order 排序：order=0 的排在前面
    assert.equal(body.comics[0].comicId, comic2Id)
    assert.equal(body.comics[1].comicId, comic1Id)
    // 每个成员包含完整漫画信息
    assert.ok(body.comics[0].comic)
    assert.equal(body.comics[0].comic._id, comic2Id)
    assert.ok(body.comics[1].comic)
    assert.equal(body.comics[1].comic._id, comic1Id)
  })

  it('public gets 404 for non-published series', async () => {
    const res = await fetch(baseUrl + '/api/v1/series/' + draftId)
    assert.equal(res.status, 404)
    assert.equal((await res.json()).code, 'SERIES_NOT_FOUND')
  })

  it('admin can view draft series', async () => {
    const res = await fetch(baseUrl + '/api/v1/series/' + draftId, {
      headers: { Cookie: adminCookie },
    })
    assert.equal(res.status, 200)
    assert.equal((await res.json()).status, SERIES_STATUS.DRAFT)
  })

  it('non-existent id returns 404', async () => {
    const res = await fetch(baseUrl + '/api/v1/series/ffffffff-ffff-ffff-ffff-ffffffffffff')
    assert.equal(res.status, 404)
    assert.equal((await res.json()).code, 'SERIES_NOT_FOUND')
  })

  it('empty series returns empty comics array', async () => {
    const res = await fetch(baseUrl + '/api/v1/series/' + draftId, {
      headers: { Cookie: adminCookie },
    })
    assert.equal(res.status, 200)
    assert.deepStrictEqual((await res.json()).comics, [])
  })
})

describe('PUT /api/v1/series/:id', () => {
  let seriesId
  let comic1Id

  beforeEach(async () => {
    const comic = await createTestComic()
    comic1Id = comic._id
    const series = await Series.create({
      title: 'Original Series',
      status: SERIES_STATUS.DRAFT,
      isCompleted: false,
    })
    seriesId = series._id
  })

  it('admin updates title', async () => {
    const res = await fetch(baseUrl + '/api/v1/series/' + seriesId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ title: 'New Title' }),
    })
    assert.equal(res.status, 200)
    assert.equal((await res.json()).title, 'New Title')
  })

  it('admin updates isCompleted', async () => {
    const res = await fetch(baseUrl + '/api/v1/series/' + seriesId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ isCompleted: true }),
    })
    assert.equal(res.status, 200)
    assert.equal((await res.json()).isCompleted, true)
  })

  it('admin updates comics (full replacement)', async () => {
    const c2 = await createTestComic()
    const res = await fetch(baseUrl + '/api/v1/series/' + seriesId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        comics: [
          { comicId: comic1Id, order: 0 },
          { comicId: c2._id, order: 1 },
        ],
      }),
    })
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.comics.length, 2)
  })

  it('editing series with its own comics is allowed', async () => {
    // 先添加漫画到连载
    await Series.findByIdAndUpdate(seriesId, {
      $set: { comics: [{ comicId: comic1Id, order: 0 }] },
    })
    // 编辑时排除自己，不应报 COMIC_ALREADY_IN_SERIES
    const c2 = await createTestComic()
    const res = await fetch(baseUrl + '/api/v1/series/' + seriesId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        comics: [
          { comicId: comic1Id, order: 0 },
          { comicId: c2._id, order: 1 },
        ],
      }),
    })
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.comics.length, 2)
  })

  it('unauthenticated returns 401', async () => {
    const res = await fetch(baseUrl + '/api/v1/series/' + seriesId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Hack' }),
    })
    assert.equal(res.status, 401)
  })

  it('non-existent series returns 404', async () => {
    const res = await fetch(baseUrl + '/api/v1/series/ffffffff-ffff-ffff-ffff-ffffffffffff', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ title: 'Ghost' }),
    })
    assert.equal(res.status, 404)
    assert.equal((await res.json()).code, 'SERIES_NOT_FOUND')
  })

  it('empty body returns 400', async () => {
    const res = await fetch(baseUrl + '/api/v1/series/' + seriesId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({}),
    })
    assert.equal(res.status, 400)
    assert.equal((await res.json()).code, 'VALIDATION_ERROR')
  })

  it('status field is ignored in update', async () => {
    const res = await fetch(baseUrl + '/api/v1/series/' + seriesId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ title: 'Try status', status: 'published' }),
    })
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.status, SERIES_STATUS.DRAFT)
    assert.equal(body.title, 'Try status')
  })
})

/** 连载生命周期操作测试 */
describe('POST /api/v1/series/:id/publish', () => {
  let seriesId

  beforeEach(async () => {
    const series = await Series.create({
      title: 'Publish Test',
      status: SERIES_STATUS.DRAFT,
    })
    seriesId = series._id
  })

  it('draft → 200 published and publishedAt is set', async () => {
    const res = await fetch(baseUrl + '/api/v1/series/' + seriesId + '/publish', {
      method: 'POST',
      headers: { Cookie: adminCookie },
    })
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.status, SERIES_STATUS.PUBLISHED)
    assert.ok(body.publishedAt)
  })

  it('unpublished → 200 published', async () => {
    await Series.findByIdAndUpdate(seriesId, { $set: { status: SERIES_STATUS.UNPUBLISHED } })
    const res = await fetch(baseUrl + '/api/v1/series/' + seriesId + '/publish', {
      method: 'POST',
      headers: { Cookie: adminCookie },
    })
    assert.equal(res.status, 200)
  })

  it('already published → 409 SERIES_STATUS_CONFLICT', async () => {
    await Series.findByIdAndUpdate(seriesId, { $set: { status: SERIES_STATUS.PUBLISHED } })
    const res = await fetch(baseUrl + '/api/v1/series/' + seriesId + '/publish', {
      method: 'POST',
      headers: { Cookie: adminCookie },
    })
    assert.equal(res.status, 409)
    assert.equal((await res.json()).code, 'SERIES_STATUS_CONFLICT')
  })

  it('deleted → 409 SERIES_STATUS_CONFLICT', async () => {
    await Series.findByIdAndUpdate(seriesId, { $set: { status: SERIES_STATUS.DELETED } })
    const res = await fetch(baseUrl + '/api/v1/series/' + seriesId + '/publish', {
      method: 'POST',
      headers: { Cookie: adminCookie },
    })
    assert.equal(res.status, 409)
    assert.equal((await res.json()).code, 'SERIES_STATUS_CONFLICT')
  })

  it('unauthenticated → 401', async () => {
    const res = await fetch(baseUrl + '/api/v1/series/' + seriesId + '/publish', {
      method: 'POST',
    })
    assert.equal(res.status, 401)
  })

  it('non-existent series → 404', async () => {
    const res = await fetch(baseUrl + '/api/v1/series/ffffffff-ffff-ffff-ffff-ffffffffffff/publish', {
      method: 'POST',
      headers: { Cookie: adminCookie },
    })
    assert.equal(res.status, 404)
    assert.equal((await res.json()).code, 'SERIES_NOT_FOUND')
  })
})

describe('POST /api/v1/series/:id/unpublish', () => {
  let seriesId

  beforeEach(async () => {
    const series = await Series.create({
      title: 'Unpublish Test',
      status: SERIES_STATUS.PUBLISHED,
      publishedAt: new Date(),
    })
    seriesId = series._id
  })

  it('published → 200 unpublished', async () => {
    const res = await fetch(baseUrl + '/api/v1/series/' + seriesId + '/unpublish', {
      method: 'POST',
      headers: { Cookie: adminCookie },
    })
    assert.equal(res.status, 200)
    assert.equal((await res.json()).status, SERIES_STATUS.UNPUBLISHED)
  })

  it('draft → 409 SERIES_STATUS_CONFLICT', async () => {
    await Series.findByIdAndUpdate(seriesId, { $set: { status: SERIES_STATUS.DRAFT } })
    const res = await fetch(baseUrl + '/api/v1/series/' + seriesId + '/unpublish', {
      method: 'POST',
      headers: { Cookie: adminCookie },
    })
    assert.equal(res.status, 409)
    assert.equal((await res.json()).code, 'SERIES_STATUS_CONFLICT')
  })

  it('already unpublished → 409 SERIES_STATUS_CONFLICT', async () => {
    await Series.findByIdAndUpdate(seriesId, { $set: { status: SERIES_STATUS.UNPUBLISHED } })
    const res = await fetch(baseUrl + '/api/v1/series/' + seriesId + '/unpublish', {
      method: 'POST',
      headers: { Cookie: adminCookie },
    })
    assert.equal(res.status, 409)
    assert.equal((await res.json()).code, 'SERIES_STATUS_CONFLICT')
  })

  it('deleted → 409 SERIES_STATUS_CONFLICT', async () => {
    await Series.findByIdAndUpdate(seriesId, { $set: { status: SERIES_STATUS.DELETED } })
    const res = await fetch(baseUrl + '/api/v1/series/' + seriesId + '/unpublish', {
      method: 'POST',
      headers: { Cookie: adminCookie },
    })
    assert.equal(res.status, 409)
    assert.equal((await res.json()).code, 'SERIES_STATUS_CONFLICT')
  })

  it('unauthenticated → 401', async () => {
    const res = await fetch(baseUrl + '/api/v1/series/' + seriesId + '/unpublish', {
      method: 'POST',
    })
    assert.equal(res.status, 401)
  })

  it('non-existent series → 404', async () => {
    const res = await fetch(baseUrl + '/api/v1/series/ffffffff-ffff-ffff-ffff-ffffffffffff/unpublish', {
      method: 'POST',
      headers: { Cookie: adminCookie },
    })
    assert.equal(res.status, 404)
    assert.equal((await res.json()).code, 'SERIES_NOT_FOUND')
  })
})

describe('DELETE /api/v1/series/:id', () => {
  let draftId
  let unpublishedId
  let publishedId

  beforeEach(async () => {
    const [draft, unpublished, published] = await Series.create([
      { title: 'Draft Delete', status: SERIES_STATUS.DRAFT },
      { title: 'Unpub Delete', status: SERIES_STATUS.UNPUBLISHED },
      { title: 'Pub Delete', status: SERIES_STATUS.PUBLISHED, publishedAt: new Date() },
    ])
    draftId = draft._id
    unpublishedId = unpublished._id
    publishedId = published._id
  })

  it('draft → 204 deleted', async () => {
    const res = await fetch(baseUrl + '/api/v1/series/' + draftId, {
      method: 'DELETE',
      headers: { Cookie: adminCookie },
    })
    assert.equal(res.status, 204)

    const series = await Series.findById(draftId).lean()
    assert.equal(series.status, SERIES_STATUS.DELETED)
  })

  it('unpublished → 204 deleted', async () => {
    const res = await fetch(baseUrl + '/api/v1/series/' + unpublishedId, {
      method: 'DELETE',
      headers: { Cookie: adminCookie },
    })
    assert.equal(res.status, 204)

    const series = await Series.findById(unpublishedId).lean()
    assert.equal(series.status, SERIES_STATUS.DELETED)
  })

  it('published → 409 SERIES_STATUS_CONFLICT', async () => {
    const res = await fetch(baseUrl + '/api/v1/series/' + publishedId, {
      method: 'DELETE',
      headers: { Cookie: adminCookie },
    })
    assert.equal(res.status, 409)
    assert.equal((await res.json()).code, 'SERIES_STATUS_CONFLICT')
  })

  it('already deleted → 409 SERIES_STATUS_CONFLICT', async () => {
    await Series.findByIdAndUpdate(draftId, { $set: { status: SERIES_STATUS.DELETED } })
    const res = await fetch(baseUrl + '/api/v1/series/' + draftId, {
      method: 'DELETE',
      headers: { Cookie: adminCookie },
    })
    assert.equal(res.status, 409)
    assert.equal((await res.json()).code, 'SERIES_STATUS_CONFLICT')
  })

  it('unauthenticated → 401', async () => {
    const res = await fetch(baseUrl + '/api/v1/series/' + draftId, {
      method: 'DELETE',
    })
    assert.equal(res.status, 401)
  })

  it('non-existent series → 404', async () => {
    const res = await fetch(baseUrl + '/api/v1/series/ffffffff-ffff-ffff-ffff-ffffffffffff', {
      method: 'DELETE',
      headers: { Cookie: adminCookie },
    })
    assert.equal(res.status, 404)
    assert.equal((await res.json()).code, 'SERIES_NOT_FOUND')
  })

  it('deleting series does NOT change member comics seriesId', async () => {
    const comic = await createTestComic({ seriesId: draftId })
    // 把漫画加到连载
    await Series.findByIdAndUpdate(draftId, {
      $set: { comics: [{ comicId: comic._id, order: 0 }] },
    })

    const res = await fetch(baseUrl + '/api/v1/series/' + draftId, {
      method: 'DELETE',
      headers: { Cookie: adminCookie },
    })
    assert.equal(res.status, 204)

    // 漫画的 seriesId 不变（不级联解绑）
    const updatedComic = await Comic.findById(comic._id).lean()
    assert.equal(updatedComic.seriesId, draftId)
  })
})

describe('POST /api/v1/series/:id/restore', () => {
  let seriesId

  beforeEach(async () => {
    const series = await Series.create({
      title: 'Restore Test',
      status: SERIES_STATUS.DELETED,
    })
    seriesId = series._id
  })

  it('deleted → 200 draft, publishedAt is cleared', async () => {
    await Series.findByIdAndUpdate(seriesId, { $set: { publishedAt: new Date('2025-01-01') } })
    const res = await fetch(baseUrl + '/api/v1/series/' + seriesId + '/restore', {
      method: 'POST',
      headers: { Cookie: adminCookie },
    })
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.status, SERIES_STATUS.DRAFT)
    assert.equal(body.publishedAt, null)
  })

  it('draft → 409 SERIES_STATUS_CONFLICT', async () => {
    await Series.findByIdAndUpdate(seriesId, { $set: { status: SERIES_STATUS.DRAFT } })
    const res = await fetch(baseUrl + '/api/v1/series/' + seriesId + '/restore', {
      method: 'POST',
      headers: { Cookie: adminCookie },
    })
    assert.equal(res.status, 409)
    assert.equal((await res.json()).code, 'SERIES_STATUS_CONFLICT')
  })

  it('published → 409 SERIES_STATUS_CONFLICT', async () => {
    await Series.findByIdAndUpdate(seriesId, { $set: { status: SERIES_STATUS.PUBLISHED } })
    const res = await fetch(baseUrl + '/api/v1/series/' + seriesId + '/restore', {
      method: 'POST',
      headers: { Cookie: adminCookie },
    })
    assert.equal(res.status, 409)
    assert.equal((await res.json()).code, 'SERIES_STATUS_CONFLICT')
  })

  it('unpublished → 409 SERIES_STATUS_CONFLICT', async () => {
    await Series.findByIdAndUpdate(seriesId, { $set: { status: SERIES_STATUS.UNPUBLISHED } })
    const res = await fetch(baseUrl + '/api/v1/series/' + seriesId + '/restore', {
      method: 'POST',
      headers: { Cookie: adminCookie },
    })
    assert.equal(res.status, 409)
    assert.equal((await res.json()).code, 'SERIES_STATUS_CONFLICT')
  })

  it('unauthenticated → 401', async () => {
    const res = await fetch(baseUrl + '/api/v1/series/' + seriesId + '/restore', {
      method: 'POST',
    })
    assert.equal(res.status, 401)
  })

  it('non-existent series → 404', async () => {
    const res = await fetch(baseUrl + '/api/v1/series/ffffffff-ffff-ffff-ffff-ffffffffffff/restore', {
      method: 'POST',
      headers: { Cookie: adminCookie },
    })
    assert.equal(res.status, 404)
    assert.equal((await res.json()).code, 'SERIES_NOT_FOUND')
  })
})

/** 端到端状态流转测试 */
describe('series lifecycle E2E flow', () => {
  let seriesId

  beforeEach(async () => {
    const series = await Series.create({
      title: 'Lifecycle Test',
      status: SERIES_STATUS.DRAFT,
    })
    seriesId = series._id
  })

  it('draft → publish → unpublish → delete → restore → draft', async () => {
    // 1. 发布
    let res = await fetch(baseUrl + '/api/v1/series/' + seriesId + '/publish', {
      method: 'POST', headers: { Cookie: adminCookie },
    })
    assert.equal(res.status, 200)
    assert.equal((await res.json()).status, SERIES_STATUS.PUBLISHED)

    // 2. 下架
    res = await fetch(baseUrl + '/api/v1/series/' + seriesId + '/unpublish', {
      method: 'POST', headers: { Cookie: adminCookie },
    })
    assert.equal(res.status, 200)
    assert.equal((await res.json()).status, SERIES_STATUS.UNPUBLISHED)

    // 3. 删除
    res = await fetch(baseUrl + '/api/v1/series/' + seriesId, {
      method: 'DELETE', headers: { Cookie: adminCookie },
    })
    assert.equal(res.status, 204)

    // 4. 恢复
    res = await fetch(baseUrl + '/api/v1/series/' + seriesId + '/restore', {
      method: 'POST', headers: { Cookie: adminCookie },
    })
    assert.equal(res.status, 200)
    assert.equal((await res.json()).status, SERIES_STATUS.DRAFT)
  })

  it('draft → delete → restore → publish', async () => {
    // draft 跳过发布，直接删除再恢复再发布
    let res = await fetch(baseUrl + '/api/v1/series/' + seriesId, {
      method: 'DELETE', headers: { Cookie: adminCookie },
    })
    assert.equal(res.status, 204)

    res = await fetch(baseUrl + '/api/v1/series/' + seriesId + '/restore', {
      method: 'POST', headers: { Cookie: adminCookie },
    })
    assert.equal(res.status, 200)
    assert.equal((await res.json()).status, SERIES_STATUS.DRAFT)

    res = await fetch(baseUrl + '/api/v1/series/' + seriesId + '/publish', {
      method: 'POST', headers: { Cookie: adminCookie },
    })
    assert.equal(res.status, 200)
    assert.equal((await res.json()).status, SERIES_STATUS.PUBLISHED)
  })

  it('published cannot be deleted directly', async () => {
    await fetch(baseUrl + '/api/v1/series/' + seriesId + '/publish', {
      method: 'POST', headers: { Cookie: adminCookie },
    })

    const res = await fetch(baseUrl + '/api/v1/series/' + seriesId, {
      method: 'DELETE', headers: { Cookie: adminCookie },
    })
    assert.equal(res.status, 409)
    assert.equal((await res.json()).code, 'SERIES_STATUS_CONFLICT')
  })

  it('draft series with isCompleted=true can be published', async () => {
    await Series.findByIdAndUpdate(seriesId, { $set: { isCompleted: true } })

    const res = await fetch(baseUrl + '/api/v1/series/' + seriesId + '/publish', {
      method: 'POST', headers: { Cookie: adminCookie },
    })
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.status, SERIES_STATUS.PUBLISHED)
    assert.equal(body.isCompleted, true)
  })
})

describe('error response format', () => {
  it('error body has code, message, requestId', async () => {
    const res = await fetch(baseUrl + '/api/v1/series/ffffffff-ffff-ffff-ffff-ffffffffffff')
    assert.ok(res.status >= 400)
    const body = await res.json()
    assert.ok('code' in body)
    assert.ok('message' in body)
    assert.ok('requestId' in body)
  })
})
