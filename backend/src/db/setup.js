// 数据库启动序列 — 按顺序执行：连接 MongoDB → 建立/校验集合 JSON Schema → 创建索引

import mongoose from 'mongoose';
import Admin, { ADMIN_COLLECTION, ADMIN_JSON_SCHEMA } from '../models/admin.model.js';

/** 启动序列是否完全成功 — 由 /health/ready 消费 */
let _isReady = false;

/**
 * 查询当前数据库就绪状态
 * 仅当连接成功 + JSON Schema 校验器就位 + 索引建立后返回 true
 */
export function isDatabaseReady() {
  return _isReady;
}

/**
 * 执行完整的数据库启动序列
 * 任一步骤失败则标记未就绪，但不抛出异常
 * @param {string} mongodbUri - MongoDB 连接串
 * @param {object} logger - pino logger 实例
 */
export async function setupDatabase(mongodbUri, logger) {
  _isReady = false;

  // 1. 连接 MongoDB
  try {
    await mongoose.connect(mongodbUri);
    logger.info({ event: 'mongodb_connected' });
  } catch (err) {
    logger.error({ event: 'mongodb_connect_failed', error: err.message });
    return; // 连接失败，后续步骤全部跳过
  }

  // 2. 建立或校验 admins 集合的 JSON Schema 校验器
  try {
    await ensureJsonSchemaValidator(logger);
    logger.info({ event: 'admins_schema_validator_ensured' });
  } catch (err) {
    logger.error({ event: 'admins_schema_validator_failed', error: err.message });
    return;
  }

  // 3. 创建必要索引
  try {
    await Admin.createIndexes();
    logger.info({ event: 'admins_indexes_created' });
  } catch (err) {
    logger.error({ event: 'admins_indexes_failed', error: err.message });
    return;
  }

  _isReady = true;
  logger.info({ event: 'database_ready' });
}

/**
 * 确保 admins 集合存在 JSON Schema 校验器
 * 集合已存在时用 collMod 更新校验器；不存在时由 Mongoose 隐式创建后设置
 */
async function ensureJsonSchemaValidator(logger) {
  const db = mongoose.connection.db;
  const collections = await db.listCollections({ name: ADMIN_COLLECTION }).toArray();

  if (collections.length === 0) {
    // 集合不存在：先触发 Mongoose 创建集合，再设置校验器
    await Admin.createCollection();
  }

  // collMod 设置/更新校验器（幂等：集合已存在校验器时直接覆盖）
  await db.command({
    collMod: ADMIN_COLLECTION,
    validator: ADMIN_JSON_SCHEMA,
    validationLevel: 'strict',
    validationAction: 'error',
  });
}

/**
 * 断开 MongoDB 连接 — 供优雅关机和测试清理使用
 */
export async function disconnectDatabase() {
  _isReady = false;
  await mongoose.disconnect();
}
