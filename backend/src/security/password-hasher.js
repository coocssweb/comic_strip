import argon2 from 'argon2';

const ARGON2ID_MEMORY_COST_KIB = 19456; // 19 MiB
const ARGON2ID_TIME_COST = 2;
const ARGON2ID_PARALLELISM = 1;

/**
 * 使用 Argon2id 生成满足安全基线 (19 MiB, t=2, p=1) 的 PHC 字符串散列。
 *
 * @param {string} password NFC 规范化后的密码
 * @returns {Promise<string>} PHC 格式的散列字符串
 */
export async function hashPassword(password) {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: ARGON2ID_MEMORY_COST_KIB,
    timeCost: ARGON2ID_TIME_COST,
    parallelism: ARGON2ID_PARALLELISM,
  });
}

/**
 * 校验 Argon2id PHC 散列是否匹配指定密码。
 *
 * @param {string} phcHash PHC 散列字符串
 * @param {string} password 明文密码
 * @returns {Promise<boolean>} 是否匹配
 */
export async function verifyPassword(phcHash, password) {
  try {
    return await argon2.verify(phcHash, password);
  } catch {
    return false;
  }
}
