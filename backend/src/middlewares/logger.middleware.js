// 单行 JSON 结构化请求日志，不记录敏感信息

import pino from 'pino';

/**
 * 创建 pino 日志实例，生产环境输出纯 JSON，开发环境使用 pino-pretty。
 * 由调用方（config）传入日志级别。
 */
export function createLogger(logLevel) {
  return pino({
    level: logLevel,
    // 嵌套 depth 设为 0 保证输出为单行扁平 JSON
    nestedDepth: 0,
    formatters: {
      // 使用标准的 level 字符串而非数字
      level(label) {
        return { level: label };
      },
    },
    // 时间戳使用 ISO-8601 格式
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

/**
 * 记录每个请求的结构化信息：
 * - 时间、级别、稳定事件名、requestId
 * - HTTP 方法、路由模板、状态码、耗时
 * 不记录请求/响应正文、Cookie、密码、令牌或完整 MongoDB URI
 */
export function createLoggerMiddleware(logger) {
  return async function loggerMiddleware(ctx, next) {
    const start = Date.now();

    try {
      await next();
    } finally {
      // 始终记录，即使出错也要打出日志
      const ms = Date.now() - start;
      const logData = {
        event: 'request',
        requestId: ctx.state.requestId,
        method: ctx.method,
        // 使用 _matchedRoute 获取注册的路由模板而非实际路径
        route: ctx._matchedRoute ?? ctx.path,
        status: ctx.status,
        ms,
      };

      if (ctx.status >= 500) {
        logger.error(logData);
      } else if (ctx.status >= 400) {
        logger.warn(logData);
      } else {
        logger.info(logData);
      }
    }
  };
}
