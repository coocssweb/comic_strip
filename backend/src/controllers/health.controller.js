// 健康检查控制器 — 返回服务存活（liveness）和就绪（readiness）状态

import mongoose from 'mongoose';

/**
 * GET /health/live
 * 仅表示进程存活，不依赖任何外部资源
 */
export async function liveness(ctx) {
  ctx.body = { status: 'ok' };
}

/**
 * GET /health/ready
 * 检查 MongoDB 连接状态，未连接时返回 503
 */
export async function readiness(ctx) {
  // mongoose.connection.readyState: 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
  if (mongoose.connection.readyState === 1) {
    ctx.body = { status: 'ok' };
  } else {
    ctx.status = 503;
    ctx.body = { status: 'unavailable' };
  }
}
