import { pathToFileURL } from 'node:url';

import { createJsonLogger } from './observability/json-logger.js';
import { createServiceRuntime } from './runtime/service-runtime.js';

/**
 * 注册一次性停止信号，并把幂等生命周期结果映射为进程退出码。
 *
 * @param {{processRef?: NodeJS.Process, runtime: object, logger: object}} options
 * @returns {() => void}
 */
export function registerShutdownSignals({ processRef = process, runtime, logger }) {
  let shutdownStarted = false;
  const handleSignal = (signal) => {
    if (shutdownStarted) {
      return;
    }
    shutdownStarted = true;
    void runtime.shutdown(signal).then(
      ({ exitCode }) => {
        processRef.exitCode = exitCode;
      },
      () => {
        logger.error('服务关闭失败', { errorSummary: '未处理的关闭异常' });
        processRef.exitCode = 1;
      },
    );
  };

  processRef.once('SIGINT', handleSignal);
  processRef.once('SIGTERM', handleSignal);

  return () => {
    processRef.off('SIGINT', handleSignal);
    processRef.off('SIGTERM', handleSignal);
  };
}

/**
 * 启动进程服务；信号必须先于异步初始化注册，避免启动窗口失去优雅关闭能力。
 *
 * @param {{
 *   env?: NodeJS.ProcessEnv | Record<string, string | undefined>,
 *   processRef?: NodeJS.Process,
 *   logger?: object,
 *   runtime?: object,
 * }} options
 * @returns {Promise<object | null>}
 */
export async function main({
  env = process.env,
  processRef = process,
  logger: providedLogger,
  runtime: providedRuntime,
} = {}) {
  const logger = providedLogger ?? createJsonLogger({ level: env.LOG_LEVEL });
  const runtime = providedRuntime ?? createServiceRuntime({ env, logger });
  const removeSignals = registerShutdownSignals({ processRef, runtime, logger });

  try {
    await runtime.start();
    logger.info('服务已启动');
    return runtime;
  } catch {
    if (runtime.isShutdownRequested?.() || runtime.isDraining?.()) {
      removeSignals();
      return null;
    }
    removeSignals();
    logger.fatal('服务启动失败', { errorSummary: '运行基线初始化失败' });
    processRef.exitCode = 1;
    return null;
  }
}

const entryPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === entryPath) {
  await main();
}
