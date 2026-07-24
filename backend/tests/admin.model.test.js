// Admin 模型集成测试 — Schema 校验、JSON Schema 数据库级防线、仓库 CAS 操作

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { connectTestDb, dropTestDb } from './helpers/test-db.js';
import Admin from '../src/models/admin.model.js';
import {
  findByUsername,
  findById,
  create,
  incrementSessionGeneration,
} from '../src/repositories/admin.repository.js';

let dbName;

before(async () => {
  dbName = await connectTestDb();
});

after(async () => {
  await dropTestDb(dbName);
});

describe('Admin Schema 校验（Mongoose 层）', () => {
  it('创建合法管理员记录成功', async () => {
    const admin = new Admin({
      username: 'test-admin',
      passwordHash: '$argon2id$hash',
    });
    await admin.save();
    assert.ok(admin._id);
    assert.equal(admin.username, 'test-admin');
    assert.equal(admin.sessionGeneration, 1);
    assert.ok(admin.createdAt);
    assert.ok(admin.updatedAt);
  });

  it('严格模式拒绝未声明的额外字段', async () => {
    const admin = new Admin({
      username: 'extra-field-admin',
      passwordHash: '$argon2id$hash',
      forbiddenField: 'should-not-exist',
    });
    // strict: true 时，未声明字段被静默丢弃
    await admin.save();
    const saved = await Admin.findById(admin._id).lean();
    assert.equal(saved.forbiddenField, undefined);
  });

  it('sessionGeneration 默认值为 1', async () => {
    const admin = new Admin({
      username: 'session-test-admin',
      passwordHash: '$argon2id$hash',
    });
    await admin.save();
    assert.equal(admin.sessionGeneration, 1);
  });

  it('username 唯一索引生效', async () => {
    const admin1 = new Admin({
      username: 'unique-test',
      passwordHash: '$argon2id$hash',
    });
    await admin1.save();

    const admin2 = new Admin({
      username: 'unique-test',
      passwordHash: '$argon2id$hash',
    });
    await assert.rejects(
      () => admin2.save(),
      (err) => err.code === 11000,
    );
  });

  it('禁用 __v 字段', async () => {
    const admin = new Admin({
      username: 'no-version-key',
      passwordHash: '$argon2id$hash',
    });
    await admin.save();
    const doc = admin.toObject();
    assert.equal(doc.__v, undefined);
  });

  it('required 字段缺失时校验失败', async () => {
    // 缺少 passwordHash
    const admin = new Admin({ username: 'missing-pwd' });
    await assert.rejects(
      () => admin.save(),
      (err) => err.name === 'ValidationError',
    );
  });
});

describe('Admin JSON Schema 校验（数据库级防线）', () => {
  it('额外字段在数据库级被拒绝', async () => {
    const db = mongoose.connection.db;
    // 绕过 Mongoose Schema，直接用驱动插入额外字段
    await assert.rejects(
      () =>
        db.collection('admins').insertOne({
          username: 'direct-insert',
          passwordHash: '$argon2id$hash',
          illegalField: 'should-fail',
        }),
      (err) => err.code === 121, // DocumentValidationFailure
    );
  });

  it('合法文档可通过数据库级 JSON Schema 校验', async () => {
    const db = mongoose.connection.db;
    const result = await db.collection('admins').insertOne({
      username: 'schema-valid',
      passwordHash: '$argon2id$hash',
    });
    assert.ok(result.insertedId);
  });

  it('缺少必填字段时被数据库级校验拒绝', async () => {
    const db = mongoose.connection.db;
    await assert.rejects(
      () =>
        db.collection('admins').insertOne({
          username: 'no-hash',
          // 缺少 passwordHash
        }),
      (err) => err.code === 121,
    );
  });

  it('sessionGeneration 小于 1 时被数据库级校验拒绝', async () => {
    const db = mongoose.connection.db;
    await assert.rejects(
      () =>
        db.collection('admins').insertOne({
          username: 'negative-session',
          passwordHash: '$argon2id$hash',
          sessionGeneration: 0,
        }),
      (err) => err.code === 121,
    );
  });
});

describe('Admin Repository 层', () => {
  it('findByUsername 按用户名查找', async () => {
    await create({
      username: 'repo-find-user',
      passwordHash: '$argon2id$hash',
    });

    const found = await findByUsername('repo-find-user');
    assert.ok(found);
    assert.equal(found.username, 'repo-find-user');
  });

  it('findByUsername 不存在的用户返回 null', async () => {
    const found = await findByUsername('nonexistent');
    assert.equal(found, null);
  });

  it('findById 按 ID 查找', async () => {
    const admin = await create({
      username: 'repo-find-id',
      passwordHash: '$argon2id$hash',
    });

    const found = await findById(admin._id);
    assert.ok(found);
    assert.equal(found.username, 'repo-find-id');
  });

  it('create 创建管理员并返回不含 __v 的对象', async () => {
    const admin = await create({
      username: 'repo-create-test',
      passwordHash: '$argon2id$hash',
    });
    assert.ok(admin._id);
    assert.equal(admin.username, 'repo-create-test');
    assert.equal(admin.sessionGeneration, 1);
    assert.equal(admin.__v, undefined);
  });

  it('incrementSessionGeneration CAS 成功增量', async () => {
    const admin = await create({
      username: 'cas-success',
      passwordHash: '$argon2id$hash',
    });
    assert.equal(admin.sessionGeneration, 1);

    const updated = await incrementSessionGeneration(admin._id, 1);
    assert.equal(updated.sessionGeneration, 2);
  });

  it('incrementSessionGeneration CAS 前值不匹配时抛出 409', async () => {
    const admin = await create({
      username: 'cas-conflict',
      passwordHash: '$argon2id$hash',
    });

    // 使用错误的 expectedGeneration
    await assert.rejects(
      () => incrementSessionGeneration(admin._id, 99),
      (err) => err.status === 409 && err.code === 'SESSION_CONFLICT',
    );
  });
});
