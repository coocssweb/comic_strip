import mongoose from 'mongoose';

/**
 * 建立独立 Mongoose 连接，避免全局默认连接在测试库之间共享状态。
 *
 * @param {string} mongoDbUri
 * @returns {Promise<import('mongoose').Connection>}
 */
export async function createMongoConnection(mongoDbUri) {
  const connection = mongoose.createConnection(mongoDbUri, {
    autoCreate: false,
    autoIndex: false,
  });

  try {
    await connection.asPromise();
    return connection;
  } catch {
    try {
      await connection.close();
    } catch {
      // 连接失败后的兜底关闭不能覆盖稳定的安全错误摘要。
    }
    throw new Error('MongoDB 连接失败');
  }
}
