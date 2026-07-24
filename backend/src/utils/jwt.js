// JWT 签名与验证工具 — 基于 jsonwebtoken 库，统一管理签名选项

import jwt from 'jsonwebtoken';

/** JWT 签发者标识 */
const ISSUER = 'comic-strip-admin';

/**
 * 签发 JWT token
 * @param {{ sub: string, sid: string, gen: number }} payload - sub=adminId, sid=sessionId, gen=sessionGeneration
 * @param {string} secret - JWT 签名密钥
 * @param {number} expiresInSeconds - 过期时间（秒）
 * @returns {string} 签发的 JWT 字符串
 */
export function signToken(payload, secret, expiresInSeconds) {
  return jwt.sign(payload, secret, {
    issuer: ISSUER,
    expiresIn: expiresInSeconds,
  });
}

/**
 * 验证并解码 JWT token
 * @param {string} token - JWT 字符串
 * @param {string} secret - JWT 签名密钥
 * @returns {{ sub: string, sid: string, gen: number, iat: number, exp: number }} 解码后的 payload
 * @throws {jwt.JsonWebTokenError|jwt.TokenExpiredError} token 无效或过期时抛出
 */
export function verifyToken(token, secret) {
  return jwt.verify(token, secret, { issuer: ISSUER });
}
