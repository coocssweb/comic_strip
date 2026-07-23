import { createHmac, timingSafeEqual } from 'node:crypto';

function base64UrlEncode(str) {
  return Buffer.from(str).toString('base64url');
}

function base64UrlDecode(str) {
  return Buffer.from(str, 'base64url').toString('utf8');
}

/**
 * 签发固定头部与声明的 HS256 管理 JWT 令牌。
 *
 * @param {{
 *   jti: string,
 *   iat: number,
 *   exp: number,
 *   sessionGeneration: number,
 *   csrfToken: string,
 * }} claims
 * @param {Buffer} secret HMAC 安全密钥
 * @returns {string} JWT 字符串
 */
export function signAdminJwt(claims, secret) {
  const header = {
    alg: 'HS256',
    typ: 'admin-session+jwt',
  };

  const payload = {
    iss: 'comic-strip-api',
    aud: 'comic-strip-admin',
    sub: 'primary-admin',
    jti: claims.jti,
    iat: claims.iat,
    exp: claims.exp,
    sessionGeneration: claims.sessionGeneration,
    csrfToken: claims.csrfToken,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const secretBuffer = Buffer.isBuffer(secret) ? secret : Buffer.from(secret);
  const signature = createHmac('sha256', secretBuffer).update(signingInput).digest('base64url');

  return `${signingInput}.${signature}`;
}

/**
 * 校验 HS256 管理 JWT 签名、头部及固定声明，允许最大 30 秒时钟偏差。
 *
 * @param {string} jwt JWT 字符串
 * @param {Buffer} secret HMAC 安全密钥
 * @returns {object} 解析并校验通过的 JWT Payload
 */
export function verifyAdminJwt(jwt, secret) {
  if (typeof jwt !== 'string') {
    throw new Error('JWT 格式无效');
  }

  const parts = jwt.split('.');
  if (parts.length !== 3) {
    throw new Error('JWT 格式无效');
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const secretBuffer = Buffer.isBuffer(secret) ? secret : Buffer.from(secret);
  const expectedSignature = createHmac('sha256', secretBuffer).update(signingInput).digest('base64url');

  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    throw new Error('JWT 签名无效');
  }

  let header;
  let payload;
  try {
    header = JSON.parse(base64UrlDecode(encodedHeader));
    payload = JSON.parse(base64UrlDecode(encodedPayload));
  } catch {
    throw new Error('JWT 格式解析失败');
  }

  if (header.alg !== 'HS256' || header.typ !== 'admin-session+jwt') {
    throw new Error('JWT 头部声明不受支持');
  }

  if (payload.iss !== 'comic-strip-api'
    || payload.aud !== 'comic-strip-admin'
    || payload.sub !== 'primary-admin'
    || !payload.jti
    || typeof payload.iat !== 'number'
    || typeof payload.exp !== 'number'
    || typeof payload.sessionGeneration !== 'number'
    || typeof payload.csrfToken !== 'string') {
    throw new Error('JWT 声明字段不完整或无效');
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const clockSkewToleranceSeconds = 30;

  if (payload.exp + clockSkewToleranceSeconds < nowSeconds) {
    throw new Error('JWT 令牌已过期');
  }

  return payload;
}
