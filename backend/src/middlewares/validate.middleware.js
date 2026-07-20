import Joi from 'joi';
import { ApiError } from '../utils/api-error.js';

function hasProvidedRequestBody(ctx) {
  const headers = ctx.req?.headers;

  if (!headers) {
    return ctx.request.body !== undefined;
  }

  const contentLength = headers['content-length'];
  if (typeof contentLength === 'string') {
    return Number(contentLength) > 0;
  }

  return typeof headers['transfer-encoding'] === 'string';
}

export function validate(schema) {
  return async (ctx, next) => {
    const validationTarget = {
      body: ctx.request.body,
      params: ctx.params,
    };
    const schemaKeys = schema.describe().keys || {};
    // 路径参数校验不声明 body 时，仅允许其缺失；任意已提供 body 都拒绝，嵌套对象仍保持 Joi 默认严格校验。
    // bodyparser 会把未携带请求体归一化为 {}，因此按原始 HTTP 报文判断是否存在请求体，避免将空 DELETE 误判为非法请求。
    const validationSchema = schemaKeys.body
      ? schema
      : schema.keys({
          body: hasProvidedRequestBody(ctx) ? Joi.any().forbidden() : Joi.any().optional(),
        });
    const { error, value } = validationSchema.validate(validationTarget, {
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
