// CSRF token 生成工具 — 使用密码学安全的随机字节生成不可猜测的 token

import { randomBytes } from 'node:crypto';

/** CSRF token 字节长度（32 字节 = 256 位） */
const CSRF_TOKEN_BYTES = 32;

/**
 * 生成密码学安全的随机 CSRF token（hex 编码）
 * @returns {string} 64 字符的 hex 字符串
 */
export function generateCsrfToken() {
  return randomBytes(CSRF_TOKEN_BYTES).toString('hex');
}
