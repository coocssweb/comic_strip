// 为每个 HTTP 请求分配 UUID v4 requestId

import { v4 as uuidv4 } from 'uuid';

/**
 * 生成 UUID v4 请求 ID，写入 ctx.state.requestId 并通过 X-Request-ID 响应头返回
 */
export default async function requestIdMiddleware(ctx, next) {
  const id = uuidv4();
  ctx.state.requestId = id;
  ctx.set('X-Request-ID', id);
  await next();
}
