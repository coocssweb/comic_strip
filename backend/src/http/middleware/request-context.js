import { randomUUID } from 'node:crypto';

/**
 * 为每个请求生成服务端 UUID v4，并覆盖客户端提供的同名响应关联头。
 *
 * @param {import('koa').Context} ctx
 * @param {import('koa').Next} next
 * @returns {Promise<void>}
 */
export async function requestContext(ctx, next) {
  const requestId = randomUUID();
  ctx.state.requestId = requestId;
  ctx.set('X-Request-ID', requestId);
  await next();
}
