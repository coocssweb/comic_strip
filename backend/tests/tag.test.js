// 标签集成测试 — 覆盖 Tag CRUD + 状态管理 + 推荐标签全部端点

process.env.TEST_MONGODB_URI = process.env.TEST_MONGODB_URI || 'mongodb://root:bestwish_123456@110.42.210.230:40123/comic-strip-test?authSource=admin'
process.env.MONGODB_URI = 'mongodb://root:bestwish_123456@110.42.210.230:40123/comic-strip-dev?authSource=admin'
process.env.NODE_ENV = 'test'
process.env.PORT = '0'
process.env.ADMIN_JWT_SECRET = 'test-jwt-secret-at-least-16-chars'
process.env.SECURITY_HMAC_SECRET = 'test-hmac-secret-at-least-16-chars'
process.env.ADMIN_WEB_ORIGIN = 'http://localhost:5173'
process.env.LOG_LEVEL = 'fatal'

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import argon2 from 'argon2'
import { connectTestDb, dropTestDb } from './helpers/test-db.js'
import Admin from '../src/models/admin.model.js'
import Tag, { TAG_STATUS } from '../src/models/tag.model.js'
import { createApp } from '../src/app.js'

const TEST_PASSWORD = 'TestPassword123!'
const TEST_USERNAME = 'admin-tag-test'

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

async function createTagViaApi(body) {
  const res = await fetch(baseUrl + '/admin/tags', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  return { res, body: json }
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

describe('Tag API', () => {
  describe('POST /admin/tags — 创建标签', () => {
    it('应成功创建启用的标签', async () => {
      const { res, body } = await createTagViaApi({ name: '搞笑', sortOrder: 1 })
      assert.strictEqual(res.status, 201)
      assert.strictEqual(body.success, true)
      assert.strictEqual(body.data.name, '搞笑')
      assert.strictEqual(body.data.status, TAG_STATUS.ENABLED)
      assert.strictEqual(body.data.sortOrder, 1)
    })

    it('重复名称应返回 409', async () => {
      await createTagViaApi({ name: '热血' })
      const { res, body } = await createTagViaApi({ name: '热血' })
      assert.strictEqual(res.status, 409)
      assert.strictEqual(body.code, 'TAG_NAME_DUPLICATE')
    })

    it('名称为空应返回 400', async () => {
      const { res } = await createTagViaApi({ name: '' })
      assert.strictEqual(res.status, 400)
    })

    it('名称过长应返回 400', async () => {
      const { res } = await createTagViaApi({ name: 'A'.repeat(31) })
      assert.strictEqual(res.status, 400)
    })
  })

  describe('GET /admin/tags — 查询标签列表', () => {
    it('应返回标签分页列表', async () => {
      await createTagViaApi({ name: '科幻' })
      await createTagViaApi({ name: '悬疑' })

      const res = await fetch(baseUrl + '/admin/tags?page=1&pageSize=10', {
        headers: { Cookie: adminCookie },
      })
      const json = await res.json()

      assert.strictEqual(res.status, 200)
      assert.strictEqual(json.success, true)
      assert.ok(json.data.total >= 4) // 包含前面创建的标签
      assert.ok(Array.isArray(json.data.items))
    })

    it('应支持 status 筛选', async () => {
      const res = await fetch(baseUrl + '/admin/tags?status=enabled', {
        headers: { Cookie: adminCookie },
      })
      const json = await res.json()

      assert.strictEqual(res.status, 200)
      for (const item of json.data.items) {
        assert.strictEqual(item.status, TAG_STATUS.ENABLED)
      }
    })
  })

  describe('PATCH /admin/tags/:id — 更新标签', () => {
    it('应支持重命名标签', async () => {
      const { body: created } = await createTagViaApi({ name: '日常' })
      const id = created.data._id

      const res = await fetch(baseUrl + '/admin/tags/' + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({ name: '日常搞笑' }),
      })
      const json = await res.json()

      assert.strictEqual(res.status, 200)
      assert.strictEqual(json.data.name, '日常搞笑')
    })

    it('应支持启用/停用切换', async () => {
      const { body: created } = await createTagViaApi({ name: '治愈' })
      const id = created.data._id

      // 停用
      let res = await fetch(baseUrl + '/admin/tags/' + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({ status: TAG_STATUS.DISABLED }),
      })
      let json = await res.json()
      assert.strictEqual(res.status, 200)
      assert.strictEqual(json.data.status, TAG_STATUS.DISABLED)

      // 重新启用
      res = await fetch(baseUrl + '/admin/tags/' + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({ status: TAG_STATUS.ENABLED }),
      })
      json = await res.json()
      assert.strictEqual(res.status, 200)
      assert.strictEqual(json.data.status, TAG_STATUS.ENABLED)
    })

    it('应支持设置推荐标签', async () => {
      const { body: created } = await createTagViaApi({ name: '冒险' })
      const id = created.data._id

      const res = await fetch(baseUrl + '/admin/tags/' + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({ isRecommended: true, recommendedOrder: 1 }),
      })
      const json = await res.json()

      assert.strictEqual(res.status, 200)
      assert.strictEqual(json.data.isRecommended, true)
      assert.strictEqual(json.data.recommendedOrder, 1)
    })
  })

  describe('DELETE /admin/tags/:id — 软删除标签', () => {
    it('应成功软删除标签', async () => {
      const { body: created } = await createTagViaApi({ name: '待删除' })
      const id = created.data._id

      const res = await fetch(baseUrl + '/admin/tags/' + id, {
        method: 'DELETE',
        headers: { Cookie: adminCookie },
      })
      assert.strictEqual(res.status, 204)

      // 验证标签已被软删除
      const tag = await Tag.findById(id).lean()
      assert.strictEqual(tag.status, TAG_STATUS.DELETED)
      assert.strictEqual(tag.isRecommended, false)
    })

    it('重复删除应返回 409', async () => {
      const { body: created } = await createTagViaApi({ name: '再删一次' })
      const id = created.data._id

      await fetch(baseUrl + '/admin/tags/' + id, {
        method: 'DELETE',
        headers: { Cookie: adminCookie },
      })
      const res = await fetch(baseUrl + '/admin/tags/' + id, {
        method: 'DELETE',
        headers: { Cookie: adminCookie },
      })
      assert.strictEqual(res.status, 409)
    })
  })

  describe('POST /admin/tags/:id/restore — 恢复标签', () => {
    it('应成功恢复已删除标签为停用状态', async () => {
      const { body: created } = await createTagViaApi({ name: '待恢复' })
      const id = created.data._id

      // 先删除
      await fetch(baseUrl + '/admin/tags/' + id, {
        method: 'DELETE',
        headers: { Cookie: adminCookie },
      })

      // 恢复
      const res = await fetch(baseUrl + '/admin/tags/' + id + '/restore', {
        method: 'POST',
        headers: { Cookie: adminCookie },
      })
      const json = await res.json()

      assert.strictEqual(res.status, 200)
      assert.strictEqual(json.data.status, TAG_STATUS.DISABLED)
      assert.strictEqual(json.data.isRecommended, false)
    })
  })

  describe('DELETE /admin/tags/:id/permanent — 永久清理', () => {
    it('应成功永久清理已删除标签', async () => {
      const { body: created } = await createTagViaApi({ name: '永久删除' })
      const id = created.data._id

      // 先软删除
      await fetch(baseUrl + '/admin/tags/' + id, {
        method: 'DELETE',
        headers: { Cookie: adminCookie },
      })

      // 永久清理
      const res = await fetch(baseUrl + '/admin/tags/' + id + '/permanent', {
        method: 'DELETE',
        headers: { Cookie: adminCookie },
      })
      assert.strictEqual(res.status, 204)

      // 标签应已从数据库移除
      const tag = await Tag.findById(id).lean()
      assert.strictEqual(tag, null)
    })

    it('未删除的标签不允许永久清理', async () => {
      const { body: created } = await createTagViaApi({ name: '活标签' })
      const id = created.data._id

      const res = await fetch(baseUrl + '/admin/tags/' + id + '/permanent', {
        method: 'DELETE',
        headers: { Cookie: adminCookie },
      })
      assert.strictEqual(res.status, 409)
    })
  })
})
