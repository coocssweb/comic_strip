import { createCollectionRegistry, DEFAULT_COLLECTION_DEFINITIONS } from '../db/collection-registry.js';
import { createMongoConnection } from '../db/mongo-connection.js';
import { loadRuntimeConfig } from '../config/runtime-config.js';
import { createApp } from '../http/create-app.js';
import { createJsonLogger } from '../observability/json-logger.js';

const DEFAULT_SHUTDOWN_TIMEOUT_MS = 10_000;

class StartupCancelledError extends Error {
  constructor() {
    super('服务启动已取消');
    this.name = 'StartupCancelledError';
  }
}

function waitForServerToListen(server) {
  return new Promise((resolve, reject) => {
    const handleListening = () => {
      server.off('error', handleError);
      resolve();
    };
    const handleError = (error) => {
      server.off('listening', handleListening);
      reject(error);
    };
    server.once('listening', handleListening);
    server.once('error', handleError);
  });
}

function closeHttpServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

async function waitUntilDeadline(promise, timeoutMs) {
  let timeout;
  const deadline = new Promise((resolve) => {
    timeout = setTimeout(() => resolve('timeout'), timeoutMs);
    timeout.unref?.();
  });
  try {
    return await Promise.race([
      promise.then(() => 'completed'),
      deadline,
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * 生命周期对象拥有全部资源，确保启动失败和信号停机都走同一关闭边界。
 *
 * @param {{
 *   env?: NodeJS.ProcessEnv | Record<string, string | undefined>,
 *   logger?: object,
 *   collectionDefinitions?: ReadonlyArray<object>,
 *   shutdownTimeoutMs?: number,
 *   dependencies?: object,
 * }} options
 * @returns {Readonly<{
 *   start: () => Promise<import('node:net').AddressInfo | string | null>,
 *   shutdown: (signal?: string) => Promise<{exitCode: number, timedOut: boolean, closeFailed: boolean}>,
 *   address: () => import('node:net').AddressInfo | string | null,
 *   isDraining: () => boolean,
 *   isShutdownRequested: () => boolean,
 *   isStopped: () => boolean,
 *   logger: () => object,
 * }>}
 */
export function createServiceRuntime({
  env = process.env,
  logger: providedLogger,
  collectionDefinitions = DEFAULT_COLLECTION_DEFINITIONS,
  shutdownTimeoutMs = DEFAULT_SHUTDOWN_TIMEOUT_MS,
  dependencies: dependencyOverrides = {},
} = {}) {
  const dependencies = {
    loadConfig: loadRuntimeConfig,
    connectMongo: createMongoConnection,
    createRegistry: createCollectionRegistry,
    createApplication: createApp,
    ...dependencyOverrides,
  };
  const logger = providedLogger ?? createJsonLogger({ level: env.LOG_LEVEL });

  let state = 'idle';
  let connection;
  let registry;
  let server;
  let startPromise;
  let shutdownPromise;
  let stopRequested = false;

  const readiness = Object.freeze({
    isDraining: () => state === 'draining' || state === 'stopped',
    async verify() {
      if (state !== 'ready' || !connection || !registry) {
        throw new Error('服务尚未就绪');
      }
      await registry.verify(connection.db);
    },
  });

  async function performStart() {
    if (stopRequested) {
      throw new StartupCancelledError();
    }
    state = 'starting';
    try {
      const config = dependencies.loadConfig(env);
      assertStartupContinues();
      connection = await dependencies.connectMongo(config.mongoDbUri);
      assertStartupContinues();
      registry = dependencies.createRegistry({ definitions: collectionDefinitions });
      await registry.ensure(connection.db);
      assertStartupContinues();
      await registry.verify(connection.db);
      assertStartupContinues();

      const app = dependencies.createApplication({ config, logger, readiness });
      server = app.listen(config.port, '127.0.0.1');
      server.on('request', (_request, response) => {
        response.once('finish', () => {
          // 已有请求完成后关闭其 keep-alive 空闲连接，避免正常排空被客户端连接复用拖到超时。
          if (state === 'draining') {
            server.closeIdleConnections?.();
          }
        });
      });
      await waitForServerToListen(server);
      assertStartupContinues();
      state = 'ready';
      return server.address();
    } catch (error) {
      if (stopRequested) {
        throw error instanceof StartupCancelledError ? error : new StartupCancelledError();
      }
      state = 'stopped';
      await closeResourcesAfterStartupFailure();
      throw error;
    }
  }

  function assertStartupContinues() {
    if (stopRequested) {
      throw new StartupCancelledError();
    }
  }

  async function closeResourcesAfterStartupFailure() {
    if (server?.listening) {
      try {
        await closeHttpServer(server);
      } catch {
        // 启动错误保持为权威结果，兜底关闭错误只通过上层稳定摘要报告。
      }
    }
    if (connection) {
      try {
        await connection.close();
      } catch {
        // 同上，关闭失败不能覆盖原始启动失败。
      }
    }
  }

  function start() {
    if (!startPromise) {
      startPromise = performStart();
    }
    return startPromise;
  }

  async function performShutdown(signal, waitForStartup) {
    let timedOut = false;
    let closeFailed = false;

    if (waitForStartup) {
      await startPromise.catch(() => {});
    }

    if (server) {
      const httpClose = closeHttpServer(server);
      try {
        const httpResult = await waitUntilDeadline(httpClose, shutdownTimeoutMs);
        if (httpResult === 'timeout') {
          timedOut = true;
          server.closeAllConnections?.();
          // 超时后不能再无限等待 close 回调；强制断开后继续关闭 MongoDB，并以非零状态结束。
          void httpClose.catch(() => {});
        }
      } catch {
        closeFailed = true;
      }
    }

    if (connection) {
      try {
        await connection.close();
      } catch {
        closeFailed = true;
      }
    }

    state = 'stopped';
    const exitCode = timedOut || closeFailed ? 1 : 0;
    if (exitCode !== 0) {
      logger.error('服务排空失败', {
        errorSummary: timedOut ? 'HTTP 请求排空超时' : '资源关闭失败',
      });
    } else {
      logger.info('服务已安全停止', { errorSummary: signal });
    }
    return Object.freeze({ exitCode, timedOut, closeFailed });
  }

  function shutdown(signal = 'shutdown') {
    if (!shutdownPromise) {
      const waitForStartup = state === 'starting';
      stopRequested = true;
      state = 'draining';
      shutdownPromise = performShutdown(signal, waitForStartup);
    }
    return shutdownPromise;
  }

  return Object.freeze({
    start,
    shutdown,
    address: () => server?.address() ?? null,
    isDraining: () => state === 'draining',
    isShutdownRequested: () => stopRequested,
    isStopped: () => state === 'stopped',
    logger: () => logger,
  });
}
