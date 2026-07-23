import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import { createCollectionRegistry } from '../src/db/collection-registry.js';
import { createApp } from '../src/http/create-app.js';
import { createJsonLogger } from '../src/observability/json-logger.js';
import { createTestConfig } from './helpers/test-config.js';
import { openIsolatedTestDatabase } from './helpers/test-mongodb.js';

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const COLLECTION_DEFINITION = Object.freeze({
  name: 'http_runtime_fixture',
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['value'],
      properties: { value: { bsonType: 'string' } },
    },
  },
  indexes: [{ name: 'value_unique', key: { value: 1 }, unique: true }],
});

function createMemoryWriter() {
  const lines = [];
  return {
    lines,
    write(line) {
      lines.push(line);
    },
  };
}

async function listen(app) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address();
  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

let testDatabase;
let registry;
let runtime;
let logWriter;
let readinessChecks;

before(async () => {
  testDatabase = await openIsolatedTestDatabase();
  registry = createCollectionRegistry({ definitions: [COLLECTION_DEFINITION] });
  await registry.ensure(testDatabase.connection.db);
  await registry.verify(testDatabase.connection.db);

  logWriter = createMemoryWriter();
  readinessChecks = 0;
  const logger = createJsonLogger({ stdout: logWriter, stderr: logWriter, level: 'info' });
  const app = createApp({
    config: createTestConfig(),
    logger,
    readiness: {
      isDraining: () => false,
      verify: () => {
        readinessChecks += 1;
        return registry.verify(testDatabase.connection.db);
      },
    },
  });
  runtime = await listen(app);
});

after(async () => {
  if (runtime) {
    await runtime.close();
  }
  if (testDatabase) {
    await testDatabase.dropAndClose();
  }
});

test('存活检查只反映进程且不访问 MongoDB', async () => {
  const checksBeforeRequest = readinessChecks;

  const response = await fetch(`${runtime.origin}/health/live`);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
  assert.equal(readinessChecks, checksBeforeRequest);
});

test('就绪检查每次核验 MongoDB、集合校验器和索引', async () => {
  const healthyResponse = await fetch(`${runtime.origin}/health/ready`);
  assert.equal(healthyResponse.status, 200);
  assert.deepEqual(await healthyResponse.json(), { status: 'ok' });

  await testDatabase.connection.db.command({
    collMod: COLLECTION_DEFINITION.name,
    validator: { $jsonSchema: { bsonType: 'object' } },
  });
  const unavailableResponse = await fetch(`${runtime.origin}/health/ready`);
  assert.equal(unavailableResponse.status, 503);
  assert.deepEqual(await unavailableResponse.json(), { status: 'unavailable' });
  await registry.ensure(testDatabase.connection.db);
});

test('服务端生成 UUID v4 请求标识并忽略客户端请求标识', async () => {
  const response = await fetch(`${runtime.origin}/health/live`, {
    headers: { 'X-Request-ID': 'client-controlled' },
  });

  const requestId = response.headers.get('x-request-id');
  assert.match(requestId, UUID_V4_PATTERN);
  assert.notEqual(requestId, 'client-controlled');
});

test('所有响应包含安全头且健康端点不开放 CORS', async () => {
  const response = await fetch(`${runtime.origin}/health/live`, {
    headers: { Origin: 'http://localhost:4000' },
  });

  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(response.headers.get('permissions-policy'), 'geolocation=(), microphone=(), camera=()');
  assert.equal(
    response.headers.get('content-security-policy'),
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  );
  assert.equal(response.headers.has('strict-transport-security'), false);
  assert.equal(response.headers.has('access-control-allow-origin'), false);
});

test('生产响应启用一年 HSTS 且不含 preload', async () => {
  const writer = createMemoryWriter();
  const app = createApp({
    config: createTestConfig({ nodeEnv: 'production' }),
    logger: createJsonLogger({ stdout: writer, stderr: writer, level: 'info' }),
    readiness: { isDraining: () => false, verify: async () => {} },
  });
  const productionRuntime = await listen(app);

  try {
    const response = await fetch(`${productionRuntime.origin}/health/live`);
    const hsts = response.headers.get('strict-transport-security');
    assert.equal(hsts, 'max-age=31536000');
    assert.equal(hsts.includes('preload'), false);
  } finally {
    await productionRuntime.close();
  }
});

test('成功健康检查不写访问日志', async () => {
  logWriter.lines.length = 0;
  await fetch(`${runtime.origin}/health/live`);
  await fetch(`${runtime.origin}/health/ready`);

  assert.deepEqual(logWriter.lines, []);
});

test('未知请求日志只包含白名单和模板路由且不泄露敏感输入', async () => {
  const secrets = {
    password: 'raw-password-value',
    jwt: 'raw-jwt-value',
    csrf: 'raw-csrf-value',
    cookie: 'raw-cookie-value',
    ip: '203.0.113.7',
    username: 'raw-admin-name',
    mongoUri: 'mongodb://admin:raw-db-password@127.0.0.1:27017/secret',
  };
  logWriter.lines.length = 0;

  await fetch(`${runtime.origin}/private/${encodeURIComponent(secrets.mongoUri)}?username=${secrets.username}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${secrets.jwt}`,
      cookie: `admin_session=${secrets.cookie}`,
      'x-csrf-token': secrets.csrf,
      'x-forwarded-for': secrets.ip,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ password: secrets.password }),
  });

  assert.equal(logWriter.lines.length, 1);
  const serializedLog = logWriter.lines[0];
  for (const secret of Object.values(secrets)) {
    assert.equal(serializedLog.includes(secret), false);
  }
  assert.deepEqual(Object.keys(JSON.parse(serializedLog)).sort(), [
    'durationMs',
    'event',
    'level',
    'method',
    'requestId',
    'route',
    'status',
    'timestamp',
  ]);
  assert.equal(JSON.parse(serializedLog).route, 'unmatched');
  assert.equal(serializedLog.includes('\n'), true);
  assert.equal(serializedLog.trim().includes('\n'), false);
});
