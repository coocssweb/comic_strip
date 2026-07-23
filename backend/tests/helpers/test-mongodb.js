import { randomUUID } from 'node:crypto';

import { createMongoConnection } from '../../src/db/mongo-connection.js';

const TEST_DATABASE_NAME_PATTERN = /^comic_strip_test_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const TEST_SOURCE_DATABASE_NAME = 'comic_strip_test_source';

export function assertSafeTestDatabaseName(actualName, expectedName) {
  if (actualName !== expectedName || !TEST_DATABASE_NAME_PATTERN.test(actualName)) {
    throw new Error('拒绝清理不安全的测试数据库名称');
  }
}

function parseMongoTarget(uri, label) {
  let parsed;
  try {
    parsed = new URL(uri);
  } catch {
    throw new Error(`${label}格式无效`);
  }

  let databaseName;
  try {
    databaseName = decodeURIComponent(parsed.pathname.slice(1));
  } catch {
    throw new Error(`${label}格式无效`);
  }
  if (!['mongodb:', 'mongodb+srv:'].includes(parsed.protocol) || !databaseName || databaseName.includes('/')) {
    throw new Error(`${label}必须包含数据库名`);
  }
  const defaultPort = parsed.protocol === 'mongodb:' ? '27017' : '';
  const normalizedPort = parsed.port || defaultPort;
  const normalizedHost = normalizedPort
    ? `${parsed.hostname.toLowerCase()}:${normalizedPort}`
    : parsed.hostname.toLowerCase();
  return { parsed, databaseName, normalizedHost, target: `${parsed.protocol}//${normalizedHost}/${databaseName}` };
}

export function deriveTestMongoDbUri(
  sourceUri,
  identifier = randomUUID(),
  runtimeMongoDbUri = process.env.MONGODB_URI,
) {
  if (typeof sourceUri !== 'string' || sourceUri.length === 0) {
    throw new Error('真实 MongoDB 集成测试需要 TEST_MONGODB_URI');
  }

  const source = parseMongoTarget(sourceUri, 'TEST_MONGODB_URI');
  if (source.databaseName !== TEST_SOURCE_DATABASE_NAME
    && !TEST_DATABASE_NAME_PATTERN.test(source.databaseName)) {
    throw new Error('TEST_MONGODB_URI 源数据库必须处于测试命名空间');
  }

  const databaseName = `comic_strip_test_${identifier}`;
  assertSafeTestDatabaseName(databaseName, databaseName);
  source.parsed.pathname = `/${databaseName}`;

  const derivedTarget = `${source.parsed.protocol}//${source.normalizedHost}/${databaseName}`;
  if (derivedTarget === source.target) {
    throw new Error('派生测试数据库不能与源测试数据库冲突');
  }
  if (runtimeMongoDbUri) {
    const runtime = parseMongoTarget(runtimeMongoDbUri, 'MONGODB_URI');
    if (runtime.target === source.target || runtime.target === derivedTarget) {
      throw new Error('测试数据库不能与运行数据库冲突');
    }
  }

  return Object.freeze({ databaseName, uri: source.parsed.toString() });
}

export async function openIsolatedTestDatabase(sourceUri = process.env.TEST_MONGODB_URI) {
  const target = createIsolatedTestDatabaseTarget(sourceUri);
  const connection = await createMongoConnection(target.uri);

  return Object.freeze({
    connection,
    databaseName: target.databaseName,
    uri: target.uri,
    async dropAndClose() {
      const actualName = connection.db?.databaseName;
      assertSafeTestDatabaseName(actualName, target.databaseName);
      try {
        await connection.db.dropDatabase();
      } finally {
        await connection.close();
      }
    },
  });
}

export function createIsolatedTestDatabaseTarget(
  sourceUri = process.env.TEST_MONGODB_URI,
  runtimeMongoDbUri = process.env.MONGODB_URI,
) {
  const derived = deriveTestMongoDbUri(sourceUri, randomUUID(), runtimeMongoDbUri);
  return Object.freeze({
    ...derived,
    async drop() {
      const connection = await createMongoConnection(derived.uri);
      assertSafeTestDatabaseName(connection.db?.databaseName, derived.databaseName);
      try {
        await connection.db.dropDatabase();
      } finally {
        await connection.close();
      }
    },
  });
}
