// 服务入口 — 按顺序执行数据库启动序列 → 启动 HTTP 服务 → 处理优雅关闭
import { createApp } from "./app.js";
import { setupDatabase, disconnectDatabase } from "./db/setup.js";

const { app, logger, config } = createApp();

let server;

async function start() {
  // 1. 按顺序执行数据库启动序列：连接 → JSON Schema 校验器 → 索引
  // 无论 setupDatabase 成功与否，都继续启动 HTTP 服务
  // /health/ready 会反映实际就绪状态
  try {
    await setupDatabase(config.mongodbUri, logger);
  } catch (err) {
    logger.error({ event: "mongodb_connect_failed", error: err.message });
  }

  // 2. 数据库启动序列完成后才开放 HTTP 服务
  server = app.listen(config.port, () => {
    logger.info({ event: "server_started", port: config.port, env: config.nodeEnv });
  });
}

// SIGTERM 优雅关闭：
// 1. 停止接收新请求
// 2. 等待已有请求最多 10 秒
// 3. 关闭 HTTP 服务
// 4. 断开数据库连接
async function gracefulShutdown(signal) {
  logger.info({ event: "shutdown_started", signal });

  if (server) {
    server.close(() => {
      logger.info({ event: "http_server_closed" });
    });

    // 给现有请求最多 10 秒完成
    setTimeout(() => {
      logger.warn({ event: "shutdown_timeout", signal });
      process.exit(1);
    }, 10000).unref();
  }

  // 断开数据库连接
  try {
    await disconnectDatabase();
    logger.info({ event: "mongodb_disconnected" });
  } catch (err) {
    logger.error({ event: "mongodb_disconnect_error", error: err.message });
  }

  process.exit(0);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

start();
