import { ApiError } from '../utils/api-error.js';

export function validate(schema) {
  return async (ctx, next) => {
    const validationTarget = {
      body: ctx.request.body,
      params: ctx.params,
    };
    const { error, value } = schema.validate(validationTarget, {
      abortEarly: true,
      stripUnknown: false,
    });

    if (error) {
      throw new ApiError(400, 'VALIDATION_ERROR', '请求参数不合法。');
    }

    ctx.request.body = value.body;
    ctx.params = value.params;
    await next();
  };
}

export function validateBody(schema) {
  return async (ctx, next) => {
    const { error, value } = schema.validate(ctx.request.body, {
      abortEarly: true,
      stripUnknown: false,
    });

    if (error) {
      throw new ApiError(400, 'VALIDATION_ERROR', '请求参数不合法。');
    }

    ctx.request.body = value;
    await next();
  };
}

export function validateQuery(schema) {
  return async (ctx, next) => {
    const { error, value } = schema.validate(ctx.query, {
      abortEarly: true,
      stripUnknown: false,
    });

    if (error) {
      throw new ApiError(400, 'VALIDATION_ERROR', '请求参数不合法。');
    }

    ctx.state.query = value;
    await next();
  };
}
