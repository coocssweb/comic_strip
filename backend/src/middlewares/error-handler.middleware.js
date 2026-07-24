// 统一错误处理中间件 — 捕获所有未处理异常并转换为标准响应

/**
 * 业务异常类，携带 HTTP 状态码和可选的业务错误码。
 * Service 层抛出此类异常，由本中间件统一捕获并格式化。
 */
export class AppError extends Error {
  constructor(message, status = 400, code) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
  }
}

/**
 * 统一错误处理中间件。
 * - AppError → 按 status/code/message 输出标准失败响应
 * - 未知错误 → 500 + 通用提示，不暴露内部细节
 * - 始终输出结构化日志以便排查
 */
export default async function errorHandlerMiddleware(ctx, next) {
  try {
    await next();
  } catch (err) {
    // 已知的业务异常
    if (err instanceof AppError) {
      ctx.status = err.status;
      ctx.body = {
        success: false,
        message: err.message,
        ...(err.code ? { code: err.code } : {}),
      };
      return;
    }

    // 未知错误：记录完整堆栈到日志，对外只返回通用提示
    ctx.status = 500;
    ctx.body = {
      success: false,
      message: '服务器内部错误',
    };

    // 用 console.error 保证致命异常一定被记录，即使 logger 未初始化
    console.error({
      event: 'unhandled_error',
      requestId: ctx.state?.requestId,
      method: ctx.method,
      route: ctx._matchedRoute ?? ctx.path,
      error: err.message,
      stack: err.stack,
    });
  }
}
