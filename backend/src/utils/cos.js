// COS 客户端工具 — 基于 cos-nodejs-sdk-v5，从运行配置初始化 COS 实例

import COS from 'cos-nodejs-sdk-v5';

/**
 * 根据运行配置创建 COS 客户端实例。
 * 供 Service 层调用，用于图片上传、删除等操作。
 *
 * @param {{ secretId: string, secretKey: string }} cosConfig - config.cos 对象
 * @returns {COS} COS SDK 实例
 */
export function createCosClient(cosConfig) {
  return new COS({
    SecretId: cosConfig.secretId,
    SecretKey: cosConfig.secretKey,
  });
}

export default createCosClient;
