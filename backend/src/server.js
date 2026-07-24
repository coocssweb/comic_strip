// 服务入口 — 连接数据库、启动 HTTP 服务、处理优雅关闭

import mongoose from 'mongoose';
import { createApp } from './app.js';

const { app, logger, config } = createApp();

// 连接 MongoDB
let server;

async function start() {
  try {
    await mongoose.connect(config.mongodbUri);
    logger.info({ event: 'mongodb_connected' });
  } catch (err) {
    // MongoDB 连接失败不影响启动 — 健康检查 /health/ready 会报告未就绪
    logger.error({ event: 'mongodb_connect_failed', error: err.message });
  }

  server = app.listen(config.port, () => {
    logger.info({ event: 'server_started', port: config.port, env: config.nodeEnv });
  });
}

// SIGTERM 优雅关闭：
// 1. 停止接收新请求
// 2. 等待已有请求最多 10 秒
// 3. 关闭 HTTP 服务
// 4. 断开 MongoDB 连接
async function gracefulShutdown(signal) {
  logger.info({ event: 'shutdown_started', signal });

  // 停止接收新请求
  if (server) {
    server.close(() => {
      logger.info({ event: 'http_server_closed' });
    });

    // 给现有请求最多 10 秒完成
    setTimeout(() => {
      logger.warn({ event: 'shutdown_timeout', signal });
      process.exit(1);
    }, 10000).unref();
  }

  // 断开 MongoDB
  try {
    await mongoose.disconnect();
    logger.info({ event: 'mongodb_disconnected' });
  } catch (err) {
    logger.error({ event: 'mongodb_disconnect_error', error: err.message });
  }

  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

start();
