// CDN 鉴权 URL 签发工具 — 基于 COS SDK getObjectUrl 生成带时效的签名 URL
// 公开接口返回的图片 key 通过此工具替换为 CDN 鉴权 URL，有效期 30 分钟

import { createCosClient } from "./cos.js";

/**
 * 对单个 COS key 签发 CDN 鉴权 URL。
 * 使用 COS SDK 的 getObjectUrl 方法，以 CDN 域名签名生成带时效的 URL。
 *
 * @param {object} cosConfig - 运行配置中的 config.cos 对象（secretId / secretKey / bucket / region / cdnDomain）
 * @param {string} key - COS 对象 key
 * @param {number} [expiresInSeconds=1800] - URL 有效期（秒），默认 30 分钟
 * @returns {Promise<string>} 带签名的 CDN URL；COS 未配置时回退返回原始 key
 */
export async function signCdnUrl(cosConfig, key, expiresInSeconds = 1800) {
  if (!key) return null;

  // COS 未配置时优雅降级：有 CDN 域名则拼接域名，否则返回原始 key
  // 测试环境或未配置 COS 时触发此路径
  if (!cosConfig.bucket || !cosConfig.region || !cosConfig.secretId || !cosConfig.secretKey) {
    if (cosConfig.cdnDomain) return cosConfig.cdnDomain + "/" + key;
    return key;
  }

  const cosClient = createCosClient(cosConfig);

  return new Promise((resolve, reject) => {
    const params = {
      Bucket: cosConfig.bucket,
      Region: cosConfig.region,
      Key: key,
      Sign: true,
      Expires: expiresInSeconds,
    };

    // 如果配置了 CDN 域名，使用 CDN 域名签名
    if (cosConfig.cdnDomain) {
      params.Domain = cosConfig.cdnDomain;
    }

    cosClient.getObjectUrl(params, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data.Url);
      }
    });
  });
}

/**
 * 批量签发漫画对象中的图片 URL。
 * 将 comic.cover 和 comic.bodyImages 中的 key 替换为签发的 CDN URL。
 * 如果 key 为 null/空，保持原值。
 *
 * @param {object} comic - 漫画对象（包含 cover 和 bodyImages 字段）
 * @param {object} cosConfig - config.cos 配置
 * @returns {Promise<object>} 替换图片字段后的漫画对象副本
 */
export async function signComicImages(comic, cosConfig) {
  if (!comic) return comic;

  const [signedCover, signedBodyImages] = await Promise.all([
    signCdnUrl(cosConfig, comic.cover),
    Promise.all((comic.bodyImages ?? []).map((key) => signCdnUrl(cosConfig, key))),
  ]);

  return {
    ...comic,
    cover: signedCover,
    bodyImages: signedBodyImages.filter((url) => url !== null),
  };
}

export default signCdnUrl;