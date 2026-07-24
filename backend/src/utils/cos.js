// COS 客户端工具 — 基于 cos-nodejs-sdk-v5 和 qcloud-cos-sts
// 提供 COS 实例创建、STS 临时凭证签发和 HeadObject 校验

import COS from 'cos-nodejs-sdk-v5';
import STS from 'qcloud-cos-sts';

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

/**
 * 签发 STS 临时上传凭证。
 * 限制 Key 前缀为指定路径，仅授予 PutObject / PostObject 权限。
 *
 * @param {{ secretId: string, secretKey: string, bucket: string, region: string }} cosConfig
 * @param {string} keyPrefix - COS key 前缀，如 "comics/:comicId/"
 * @param {number} [durationSeconds=1800] - 临时凭证有效期（秒），默认 30 分钟
 * @returns {Promise<object>} STS 临时凭证对象，包含 credentials / startTime / expiredTime
 */
export function generateStsCredentials(cosConfig, keyPrefix, durationSeconds = 1800) {
  const policy = {
    version: '2.0',
    statement: [
      {
        action: [
          'name/cos:PutObject',
          'name/cos:PostObject',
        ],
        effect: 'allow',
        resource: [
          `qcs::cos:${cosConfig.region}:uid/*:${cosConfig.bucket}/${keyPrefix}*`,
        ],
      },
    ],
  };

  return new Promise((resolve, reject) => {
    STS.getCredential(
      {
        secretId: cosConfig.secretId,
        secretKey: cosConfig.secretKey,
        durationSeconds,
        policy,
      },
      (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      },
    );
  });
}

/**
 * 对 COS 对象执行 HeadObject 校验。
 * 返回对象元数据（size / ETag），对象不存在时返回 null。
 *
 * @param {COS} cosClient - COS SDK 实例
 * @param {{ bucket: string, region: string }} cosConfig
 * @param {string} key - COS 对象 key
 * @returns {Promise<{size: number, etag: string}|null>}
 */
export function headObject(cosClient, cosConfig, key) {
  return new Promise((resolve, reject) => {
    cosClient.headObject(
      {
        Bucket: cosConfig.bucket,
        Region: cosConfig.region,
        Key: key,
      },
      (err, data) => {
        if (err) {
          // 对象不存在时返回 null，而非抛出异常
          if (err.statusCode === 404 || err.code === 'NoSuchKey' || err.code === 'NotFound') {
            resolve(null);
          } else {
            reject(err);
          }
        } else {
          const rawEtag = data.headers?.['etag'] || data.ETag || '';
          // 去掉 COS 返回的 ETag 两侧引号
          const etag = rawEtag.replace(/^"|"$/g, '');
          // size 从 content-length 响应头中获取（单位字节）
          const size = parseInt(data.headers?.['content-length'] || '0', 10);
          resolve({ size, etag });
        }
      },
    );
  });
}

/**
 * 校验图片 key 是否在允许的漫画命名空间下。
 * key 必须以 "comics/:comicId/" 开头。
 *
 * @param {string} key - 图片 COS key
 * @param {string} comicId - 漫画 ID
 * @returns {boolean}
 */
export function isKeyInComicNamespace(key, comicId) {
  if (!key || !comicId) return false;
  const prefix = `comics/${comicId}/`;
  return key.startsWith(prefix);
}
