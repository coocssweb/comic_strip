import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import {
  createCollectionRegistry,
  DEFAULT_COLLECTION_DEFINITIONS,
} from '../src/db/collection-registry.js';
import {
  assertSafeTestDatabaseName,
  deriveTestMongoDbUri,
  openIsolatedTestDatabase,
} from './helpers/test-mongodb.js';

const COLLECTION_DEFINITION = Object.freeze({
  name: 'runtime_baseline_fixture',
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['code'],
      additionalProperties: false,
      properties: {
        _id: { bsonType: 'objectId' },
        code: { bsonType: 'string', minLength: 1 },
      },
    },
  },
  indexes: [
    { name: 'code_unique', key: { code: 1 }, unique: true },
  ],
});

test('测试库 URI 从源 URI 派生独立随机数据库且不修改源数据库名', () => {
  const identifier = '12345678-1234-4234-9234-123456789abc';
  const derived = deriveTestMongoDbUri(
    'mongodb://user:secret@127.0.0.1:27017/comic_strip_test_source?authSource=admin',
    identifier,
    'mongodb://127.0.0.1:27017/comic_strip_development',
  );

  assert.equal(derived.databaseName, `comic_strip_test_${identifier}`);
  assert.equal(new URL(derived.uri).pathname, `/comic_strip_test_${identifier}`);
  assert.equal(new URL(derived.uri).searchParams.get('authSource'), 'admin');
});

test('拒绝从非测试命名空间源数据库派生测试库', () => {
  assert.throws(
    () => deriveTestMongoDbUri('mongodb://127.0.0.1:27017/comic_strip', '12345678-1234-4234-9234-123456789abc'),
    /源数据库必须处于测试命名空间/,
  );
});

test('拒绝 TEST_MONGODB_URI 与 MONGODB_URI 指向同一源数据库', () => {
  const sourceUri = 'mongodb://127.0.0.1:27017/comic_strip_test_source';
  assert.throws(
    () => deriveTestMongoDbUri(sourceUri, '12345678-1234-4234-9234-123456789abc', sourceUri),
    /不能与运行数据库冲突/,
  );
});

test('比较运行库冲突时规范化 MongoDB 默认端口', () => {
  assert.throws(
    () => deriveTestMongoDbUri(
      'mongodb://127.0.0.1/comic_strip_test_source',
      '12345678-1234-4234-9234-123456789abc',
      'mongodb://127.0.0.1:27017/comic_strip_test_source',
    ),
    /不能与运行数据库冲突/,
  );
});

test('拒绝派生测试库与 MONGODB_URI 指向同一目标数据库', () => {
  const identifier = '12345678-1234-4234-9234-123456789abc';
  assert.throws(
    () => deriveTestMongoDbUri(
      'mongodb://127.0.0.1:27017/comic_strip_test_source',
      identifier,
      `mongodb://127.0.0.1:27017/comic_strip_test_${identifier}`,
    ),
    /不能与运行数据库冲突/,
  );
});

test('测试库清理名称必须精确匹配本次随机数据库', () => {
  assert.throws(
    () => assertSafeTestDatabaseName('comic_strip_test_12345678-1234-4234-9234-123456789abc', 'comic_strip_test_other'),
    /拒绝清理/,
  );
});

describe('真实 MongoDB 集合注册表', () => {
  let testDatabase;
  let registry;

  before(async () => {
    testDatabase = await openIsolatedTestDatabase();
    registry = createCollectionRegistry({ definitions: [COLLECTION_DEFINITION] });
  });

  after(async () => {
    if (testDatabase) {
      await testDatabase.dropAndClose();
    }
  });

  test('默认生产集合定义为空', () => {
    assert.deepEqual(DEFAULT_COLLECTION_DEFINITIONS, []);
  });

  test('首次建立集合校验器和索引后可通过核验', async () => {
    await registry.ensure(testDatabase.connection.db);
    await registry.verify(testDatabase.connection.db);

    const collection = testDatabase.connection.db.collection(COLLECTION_DEFINITION.name);
    await assert.rejects(() => collection.insertOne({ unknown: true }));
    await collection.insertOne({ code: 'alpha' });
    await assert.rejects(() => collection.insertOne({ code: 'alpha' }));
  });

  test('重复建立集合基线保持幂等', async () => {
    await registry.ensure(testDatabase.connection.db);
    await registry.ensure(testDatabase.connection.db);
    await registry.verify(testDatabase.connection.db);
  });

  test('核验拒绝运行中发生的 JSON Schema 漂移', async () => {
    await testDatabase.connection.db.command({
      collMod: COLLECTION_DEFINITION.name,
      validator: { $jsonSchema: { bsonType: 'object' } },
    });

    await assert.rejects(() => registry.verify(testDatabase.connection.db), /集合校验器与声明不一致/);
    await registry.ensure(testDatabase.connection.db);
  });

  test('核验拒绝 validationLevel 漂移', async () => {
    await testDatabase.connection.db.command({
      collMod: COLLECTION_DEFINITION.name,
      validationLevel: 'moderate',
    });

    await assert.rejects(() => registry.verify(testDatabase.connection.db), /集合校验器与执行模式不一致/);
    await registry.ensure(testDatabase.connection.db);
  });

  test('核验拒绝 validationAction 漂移', async () => {
    await testDatabase.connection.db.command({
      collMod: COLLECTION_DEFINITION.name,
      validationAction: 'warn',
    });

    await assert.rejects(() => registry.verify(testDatabase.connection.db), /集合校验器与执行模式不一致/);
    await registry.ensure(testDatabase.connection.db);
  });

  test('核验拒绝运行中发生的索引漂移', async () => {
    const collection = testDatabase.connection.db.collection(COLLECTION_DEFINITION.name);
    await collection.dropIndex('code_unique');
    await collection.createIndex({ code: -1 }, { name: 'code_unique', unique: true });

    await assert.rejects(() => registry.verify(testDatabase.connection.db), /集合索引与声明不一致/);

    await collection.dropIndex('code_unique');
    await collection.createIndex({ code: 1 }, { name: 'code_unique', unique: true });
  });

  test('核验拒绝声明外的索引安全选项', async () => {
    const collection = testDatabase.connection.db.collection(COLLECTION_DEFINITION.name);
    await collection.dropIndex('code_unique');
    await collection.createIndex({ code: 1 }, { name: 'code_unique', unique: true, sparse: true });

    await assert.rejects(() => registry.verify(testDatabase.connection.db), /集合索引与声明不一致/);

    await collection.dropIndex('code_unique');
    await collection.createIndex({ code: 1 }, { name: 'code_unique', unique: true });
  });
});
