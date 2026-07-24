// 测试数据库辅助 — 安全校验 + 独立数据库创建/清理

import mongoose from "mongoose";
import { randomUUID } from "node:crypto";

/** 当前测试数据库名称（仅清理时使用） */
let _testDbName = null;

/**
 * 安全校验：TEST_MONGODB_URI 未指向测试命名空间时拒绝执行
 */
function assertTestMongoUri(uri) {
  const parsed = new URL(uri);
  const dbName = parsed.pathname.replace(/^\//, "") || "";
  if (!dbName.toLowerCase().includes("test")) {
    throw new Error(
      `TEST_MONGODB_URI 数据库名 "${dbName}" 不包含 "test"，测试拒绝执行`,
    );
  }
}

/**
 * 构建带随机后缀的测试数据库 URI
 */
function buildTestUri() {
  const uri = process.env.TEST_MONGODB_URI;
  if (!uri) {
    throw new Error("TEST_MONGODB_URI 未设置，测试拒绝执行");
  }

  assertTestMongoUri(uri);

  const uniqueSuffix = randomUUID().slice(0, 8);
  const parsed = new URL(uri);
  const originalDbName = parsed.pathname.replace(/^\//, "") || "test";
  _testDbName = `${originalDbName}-${uniqueSuffix}`;
  parsed.pathname = `/${_testDbName}`;
  return parsed.toString();
}

/**
 * 连接到带随机后缀的测试数据库
 */
export async function connectTestDb() {
  const testUri = buildTestUri();

  // 如果已有其他连接先断开
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  await mongoose.connect(testUri);
  return _testDbName;
}

/**
 * 清理测试数据库（仅删除通过命名安全校验的数据库）
 */
export async function dropTestDb(dbName) {
  // 连接失败时 dbName 可能为 null/undefined，跳过清理
  if (!dbName) {
    return;
  }

  // 安全检查：数据库名必须包含 test
  if (!dbName.toLowerCase().includes("test")) {
    throw new Error(`数据库名 "${dbName}" 不包含 "test"，拒绝删除`);
  }

  // 仅在连接未关闭时清理
  if (mongoose.connection.readyState !== 0) {
    const db = mongoose.connection.db;
    await db.dropDatabase();
    await mongoose.disconnect();
  }

  _testDbName = null;
}
