// 健康检查控制器 — 返回服务存活（liveness）和就绪（readiness）状态
import { isDatabaseReady } from "../db/setup.js";

/**
 * GET /health/live
 * 仅表示进程存活，不依赖任何外部资源
 */
export async function liveness(ctx) {
  ctx.body = { status: "ok" };
}

/**
 * GET /health/ready
 * 检查完整的数据库启动序列是否成功（连接 + JSON Schema + 索引）
 * 未就绪时返回 503
 */
export async function readiness(ctx) {
  if (isDatabaseReady()) {
    ctx.body = { status: "ok" };
  } else {
    ctx.status = 503;
    ctx.body = { status: "unavailable" };
  }
}
