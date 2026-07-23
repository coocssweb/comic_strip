import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import http from 'node:http';
import { setImmediate as waitForImmediate } from 'node:timers/promises';
import test, { after, before, describe } from 'node:test';

import Koa from 'koa';

import { createCollectionRegistry } from '../src/db/collection-registry.js';
import { createJsonLogger } from '../src/observability/json-logger.js';
import { createServiceRuntime } from '../src/runtime/service-runtime.js';
import { main, registerShutdownSignals } from '../src/server.js';
import { createIsolatedTestDatabaseTarget } from './helpers/test-mongodb.js';

const JWT_SECRET = Buffer.from('00112233445566778899aabbccddeefffedcba98765432100123456789abcdef', 'hex').toString('base64');
const HMAC_SECRET = Buffer.from('f0e1d2c3b4a5968778695a4b3c2d1e0f0123456789abcdeffedcba9876543210', 'hex').toString('base64');
const COLLECTION_DEFINITION = Object.freeze({
  name: 'service_lifecycle_fixture',
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      properties: { value: { bsonType: 'string' } },
    },
  },
  indexes: [{ name: 'value_ascending', key: { value: 1 } }],
});

function runtimeEnvironment(mongoDbUri) {
  return {
    NODE_ENV: 'test',
    PORT: '0',
    MONGODB_URI: mongoDbUri,
    ADMIN_JWT_SECRET: JWT_SECRET,
    SECURITY_HMAC_SECRET: HMAC_SECRET,
    ADMIN_WEB_ORIGIN: 'http://localhost:4000',
    LOG_LEVEL: 'info',
  };
}

function silentLogger() {
  const writer = { write() {} };
  return createJsonLogger({ stdout: writer, stderr: writer, level: 'info' });
}

function createDeferredApplication(onRequestStarted, waitForRelease) {
  return () => {
    const app = new Koa();
    app.use(async (ctx) => {
      onRequestStarted();
      await waitForRelease;
      ctx.body = { status: 'ok' };
    });
    return app;
  };
}

function requestWithoutAgent(port, path) {
  return new Promise((resolve, reject) => {
    const request = http.get({ host: '127.0.0.1', port, path, agent: false }, (response) => {
      response.resume();
      response.once('end', () => resolve(response.statusCode));
    });
    request.once('error', reject);
  });
}

async function waitForExitCode(processRef) {
  for (let attempt = 0; attempt < 20 && processRef.exitCode === undefined; attempt += 1) {
    await waitForImmediate();
  }
  return processRef.exitCode;
}

test('无效配置在连接 MongoDB 前阻止启动', async () => {
  let connectionAttempts = 0;
  const runtime = createServiceRuntime({
    env: {},
    logger: silentLogger(),
    dependencies: {
      connectMongo: async () => {
        connectionAttempts += 1;
      },
    },
  });

  await assert.rejects(() => runtime.start(), /运行配置/);
  assert.equal(connectionAttempts, 0);
  assert.equal(runtime.address(), null);
});

test('排空等待已有 HTTP 请求并且重复关闭只关闭一次 MongoDB', async () => {
  let releaseRequest;
  const requestRelease = new Promise((resolve) => { releaseRequest = resolve; });
  let markRequestStarted;
  const requestStarted = new Promise((resolve) => { markRequestStarted = resolve; });
  let mongoCloseCount = 0;
  const runtime = createServiceRuntime({
    env: runtimeEnvironment('mongodb://127.0.0.1:27017/not-used'),
    logger: silentLogger(),
    shutdownTimeoutMs: 1_000,
    dependencies: {
      connectMongo: async () => ({ db: {}, close: async () => { mongoCloseCount += 1; } }),
      createRegistry: () => ({ ensure: async () => {}, verify: async () => {} }),
      createApplication: createDeferredApplication(markRequestStarted, requestRelease),
    },
  });
  await runtime.start();
  const address = runtime.address();
  const responsePromise = fetch(`http://127.0.0.1:${address.port}/slow`);
  await requestStarted;

  const firstShutdown = runtime.shutdown('SIGTERM');
  const secondShutdown = runtime.shutdown('SIGINT');
  assert.equal(runtime.isDraining(), true);
  assert.equal(firstShutdown, secondShutdown);
  await waitForImmediate();
  releaseRequest();

  assert.equal((await firstShutdown).exitCode, 0);
  assert.equal((await responsePromise).status, 200);
  assert.equal(mongoCloseCount, 1);
});

test('排空超过期限会强制关闭连接并返回非零状态', async () => {
  let markRequestStarted;
  const requestStarted = new Promise((resolve) => { markRequestStarted = resolve; });
  const neverRelease = new Promise(() => {});
  let mongoCloseCount = 0;
  const runtime = createServiceRuntime({
    env: runtimeEnvironment('mongodb://127.0.0.1:27017/not-used'),
    logger: silentLogger(),
    shutdownTimeoutMs: 20,
    dependencies: {
      connectMongo: async () => ({ db: {}, close: async () => { mongoCloseCount += 1; } }),
      createRegistry: () => ({ ensure: async () => {}, verify: async () => {} }),
      createApplication: createDeferredApplication(markRequestStarted, neverRelease),
    },
  });
  await runtime.start();
  const responsePromise = fetch(`http://127.0.0.1:${runtime.address().port}/slow`).catch(() => null);
  await requestStarted;

  const result = await runtime.shutdown('SIGTERM');

  assert.equal(result.exitCode, 1);
  assert.equal(result.timedOut, true);
  assert.equal(mongoCloseCount, 1);
  await responsePromise;
});

test('进程入口为 SIGINT 和 SIGTERM 各注册一次且回写退出码', async () => {
  const processRef = new EventEmitter();
  processRef.exitCode = undefined;
  let shutdownCount = 0;
  const removeSignals = registerShutdownSignals({
    processRef,
    runtime: {
      shutdown: async () => {
        shutdownCount += 1;
        return { exitCode: 0 };
      },
    },
    logger: silentLogger(),
  });

  assert.equal(processRef.listenerCount('SIGINT'), 1);
  assert.equal(processRef.listenerCount('SIGTERM'), 1);
  processRef.emit('SIGTERM');
  await waitForImmediate();
  assert.equal(shutdownCount, 1);
  assert.equal(processRef.exitCode, 0);
  removeSignals();
});

test('main 在启动前注册信号并在 fatal 阈值输出启动致命日志', async () => {
  const processRef = new EventEmitter();
  processRef.exitCode = undefined;
  const lines = [];
  const writer = { write: (line) => lines.push(line) };
  const logger = createJsonLogger({ stdout: writer, stderr: writer, level: 'fatal' });
  const runtime = {
    async start() {
      assert.equal(processRef.listenerCount('SIGINT'), 1);
      assert.equal(processRef.listenerCount('SIGTERM'), 1);
      throw new Error('预期启动失败');
    },
    async shutdown() {
      return { exitCode: 0 };
    },
    isDraining: () => false,
  };

  await main({ env: { LOG_LEVEL: 'fatal' }, processRef, logger, runtime });

  assert.equal(processRef.exitCode, 1);
  assert.equal(lines.length, 1);
  assert.equal(JSON.parse(lines[0]).level, 'fatal');
  assert.equal(JSON.parse(lines[0]).event, '服务启动失败');
});

test('main 不把启动期已完成的信号停机误报为启动失败', async () => {
  const processRef = new EventEmitter();
  processRef.exitCode = undefined;
  const lines = [];
  const writer = { write: (line) => lines.push(line) };
  const logger = createJsonLogger({ stdout: writer, stderr: writer, level: 'info' });
  let shutdownRequested = false;
  const runtime = {
    async start() {
      processRef.emit('SIGTERM');
      await waitForImmediate();
      throw new Error('启动被信号取消');
    },
    async shutdown() {
      shutdownRequested = true;
      return { exitCode: 0 };
    },
    isDraining: () => false,
    isShutdownRequested: () => shutdownRequested,
  };

  await main({ processRef, logger, runtime });

  assert.equal(processRef.exitCode, 0);
  assert.equal(lines.some((line) => JSON.parse(line).event === '服务启动失败'), false);
});

test('启动期间收到信号后不得继续监听并关闭随后取得的 MongoDB 连接', async () => {
  const processRef = new EventEmitter();
  processRef.exitCode = undefined;
  let markConnectionStarted;
  const connectionStarted = new Promise((resolve) => { markConnectionStarted = resolve; });
  let resolveConnection;
  const pendingConnection = new Promise((resolve) => { resolveConnection = resolve; });
  let connectionCloseCount = 0;
  let listenAttempts = 0;
  const runtime = createServiceRuntime({
    env: runtimeEnvironment('mongodb://127.0.0.1:27017/not-used'),
    logger: silentLogger(),
    dependencies: {
      connectMongo: async () => {
        markConnectionStarted();
        return pendingConnection;
      },
      createRegistry: () => ({ ensure: async () => {}, verify: async () => {} }),
      createApplication: () => ({
        listen() {
          listenAttempts += 1;
          const server = new EventEmitter();
          server.address = () => ({ address: '127.0.0.1', port: 40001 });
          server.close = (callback) => callback();
          queueMicrotask(() => server.emit('listening'));
          return server;
        },
      }),
    },
  });
  registerShutdownSignals({ processRef, runtime, logger: silentLogger() });

  const startPromise = runtime.start();
  await connectionStarted;
  processRef.emit('SIGTERM');
  assert.equal(runtime.isDraining(), true);
  resolveConnection({ db: {}, close: async () => { connectionCloseCount += 1; } });

  await assert.rejects(startPromise, /启动已取消/);
  assert.equal(await waitForExitCode(processRef), 0);
  assert.equal(listenAttempts, 0);
  assert.equal(connectionCloseCount, 1);
  assert.equal(runtime.address(), null);
});

test('真实 HTTP 服务收到信号后排空慢请求、拒绝新连接并回写退出码', async () => {
  const processRef = new EventEmitter();
  processRef.exitCode = undefined;
  let releaseRequest;
  const requestRelease = new Promise((resolve) => { releaseRequest = resolve; });
  let markRequestStarted;
  const requestStarted = new Promise((resolve) => { markRequestStarted = resolve; });
  let mongoCloseCount = 0;
  const runtime = createServiceRuntime({
    env: runtimeEnvironment('mongodb://127.0.0.1:27017/not-used'),
    logger: silentLogger(),
    shutdownTimeoutMs: 1_000,
    dependencies: {
      connectMongo: async () => ({ db: {}, close: async () => { mongoCloseCount += 1; } }),
      createRegistry: () => ({ ensure: async () => {}, verify: async () => {} }),
      createApplication: createDeferredApplication(markRequestStarted, requestRelease),
    },
  });
  registerShutdownSignals({ processRef, runtime, logger: silentLogger() });
  await runtime.start();
  const port = runtime.address().port;
  const slowResponse = requestWithoutAgent(port, '/slow');
  await requestStarted;

  processRef.emit('SIGTERM');
  await waitForImmediate();
  await assert.rejects(() => requestWithoutAgent(port, '/new'));
  assert.equal(processRef.exitCode, undefined);
  releaseRequest();

  assert.equal(await slowResponse, 200);
  assert.equal(await waitForExitCode(processRef), 0);
  assert.equal(mongoCloseCount, 1);
});

describe('真实 MongoDB 与 HTTP 启动顺序', () => {
  let target;
  let runtime;

  before(() => {
    target = createIsolatedTestDatabaseTarget();
  });

  after(async () => {
    if (runtime && !runtime.isStopped()) {
      await runtime.shutdown('测试清理');
    }
    if (target) {
      await target.drop();
    }
  });

  test('集合基线完成前不监听，完成后真实健康检查可用', async () => {
    let releaseEnsure;
    const ensureRelease = new Promise((resolve) => { releaseEnsure = resolve; });
    let markEnsureStarted;
    const ensureStarted = new Promise((resolve) => { markEnsureStarted = resolve; });

    runtime = createServiceRuntime({
      env: runtimeEnvironment(target.uri),
      logger: silentLogger(),
      collectionDefinitions: [COLLECTION_DEFINITION],
      dependencies: {
        createRegistry: ({ definitions }) => {
          const registry = createCollectionRegistry({ definitions });
          return {
            async ensure(db) {
              markEnsureStarted();
              await ensureRelease;
              await registry.ensure(db);
            },
            verify: (db) => registry.verify(db),
          };
        },
      },
    });

    const startPromise = runtime.start();
    await ensureStarted;
    assert.equal(runtime.address(), null);
    releaseEnsure();
    await startPromise;

    const address = runtime.address();
    assert.equal(address.address, '127.0.0.1');
    assert.equal((await fetch(`http://127.0.0.1:${address.port}/health/live`)).status, 200);
    assert.equal((await fetch(`http://127.0.0.1:${address.port}/health/ready`)).status, 200);

    const result = await runtime.shutdown('SIGTERM');
    assert.equal(result.exitCode, 0);
  });
});
