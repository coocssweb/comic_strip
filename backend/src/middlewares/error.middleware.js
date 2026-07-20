import mongoose from 'mongoose';
import { ApiError } from '../utils/api-error.js';

function mapError(error) {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof mongoose.Error.CastError) {
    return new ApiError(400, 'VALIDATION_ERROR', '请求参数不合法。');
  }

  if (error?.code === 11000) {
    return new ApiError(409, 'DUPLICATE_ACTION', '已执行过该操作。');
  }

  return new ApiError(500, 50000, '服务器内部错误');
}

export async function errorMiddleware(ctx, next) {
  try {
    await next();
  } catch (error) {
    const apiError = mapError(error);
    console.error('请求处理失败', {
      method: ctx.method,
      path: ctx.path,
      status: apiError.status,
      code: apiError.code,
      message: apiError.message,
    });
    ctx.status = apiError.status;
    ctx.body = { code: apiError.code, message: apiError.message, data: null };
  }
}
