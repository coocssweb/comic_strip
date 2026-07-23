import { createHmac } from 'node:crypto';

function computeHmacHash(secret, value) {
  const secretBuffer = Buffer.isBuffer(secret) ? secret : Buffer.from(secret);
  return createHmac('sha256', secretBuffer).update(value).digest('base64url');
}

function getRefilledTokens(doc, maxTokens, refillIntervalMs, now) {
  if (!doc) {
    return maxTokens;
  }
  const lastUpdated = doc.updatedAt ? new Date(doc.updatedAt).getTime() : now.getTime();
  const elapsed = Math.max(0, now.getTime() - lastUpdated);
  const refilled = Math.floor(elapsed / refillIntervalMs);
  return Math.min(maxTokens, (doc.tokens ?? maxTokens) + refilled);
}

/**
 * 在 Argon2id 验证前检查 IP 和用户名两个独立限速桶。
 *
 * @param {import('mongodb').Db} db
 * @param {{ip: string, username: string}} input
 * @param {{securityHmacSecret: Buffer}} config
 * @param {Date} [now]
 * @returns {Promise<{isThrottled: boolean, throttledType?: 'ip' | 'username', ipKeyHash: string, usernameKeyHash: string}>}
 */
export async function checkLoginThrottle(db, { ip, username }, config, now = new Date()) {
  const ipKeyHash = computeHmacHash(config.securityHmacSecret, `ip:${ip}`);
  const usernameKeyHash = computeHmacHash(config.securityHmacSecret, `user:${username.toLowerCase()}`);

  const col = db.collection('admin_throttles');
  const [ipDoc, userDoc] = await Promise.all([
    col.findOne({ _id: `ip:${ipKeyHash}` }),
    col.findOne({ _id: `user:${usernameKeyHash}` }),
  ]);

  if (ipDoc?.cooldownExpiresAt && new Date(ipDoc.cooldownExpiresAt) > now) {
    return { isThrottled: true, throttledType: 'ip', ipKeyHash, usernameKeyHash };
  }

  if (userDoc?.cooldownExpiresAt && new Date(userDoc.cooldownExpiresAt) > now) {
    return { isThrottled: true, throttledType: 'username', ipKeyHash, usernameKeyHash };
  }

  return { isThrottled: false, ipKeyHash, usernameKeyHash };
}

/**
 * 记录登录失败并扣减额度、在首次耗尽时触发冷却并计算递增延迟。
 *
 * @param {import('mongodb').Db} db
 * @param {{ipKeyHash: string, usernameKeyHash: string}} keys
 * @param {Date} [now]
 * @returns {Promise<{delayMs: number, ipFirstThrottled: boolean, userFirstThrottled: boolean}>}
 */
export async function recordLoginFailure(db, { ipKeyHash, usernameKeyHash }, now = new Date()) {
  const col = db.collection('admin_throttles');

  const ipId = `ip:${ipKeyHash}`;
  const userId = `user:${usernameKeyHash}`;

  const [ipDoc, userDoc] = await Promise.all([
    col.findOne({ _id: ipId }),
    col.findOne({ _id: userId }),
  ]);

  let ipFirstThrottled = false;
  let userFirstThrottled = false;

  // 1. IP 桶规则：容量 10，每 60 秒补充 1 个；耗尽后冷却 5 分钟
  const currentIpTokens = getRefilledTokens(ipDoc, 10, 60_000, now);
  const newIpTokens = Math.max(0, currentIpTokens - 1);
  let ipCooldownExpiresAt = ipDoc?.cooldownExpiresAt;
  if (newIpTokens === 0 && (!ipCooldownExpiresAt || new Date(ipCooldownExpiresAt) <= now)) {
    ipCooldownExpiresAt = new Date(now.getTime() + 5 * 60 * 1000);
    ipFirstThrottled = true;
  }
  const ipExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const ipSetDoc = {
    type: 'ip',
    keyHash: ipKeyHash,
    tokens: newIpTokens,
    updatedAt: now,
    expiresAt: ipExpiresAt,
  };
  if (ipCooldownExpiresAt) {
    ipSetDoc.cooldownExpiresAt = ipCooldownExpiresAt;
  }

  await col.updateOne({ _id: ipId }, { $set: ipSetDoc }, { upsert: true });

  // 2. 登录名桶规则：容量 5，每 5 分钟补充 1 个；冷却依次 1m, 5m, 15m
  const currentUserTokens = getRefilledTokens(userDoc, 5, 300_000, now);
  const newUserTokens = Math.max(0, currentUserTokens - 1);
  let userCooldownExpiresAt = userDoc?.cooldownExpiresAt;
  let userLevel = userDoc?.cooldownLevel ?? 0;

  if (newUserTokens === 0 && (!userCooldownExpiresAt || new Date(userCooldownExpiresAt) <= now)) {
    userLevel = Math.min(3, userLevel + 1);
    const cooldownMinutes = userLevel === 1 ? 1 : userLevel === 2 ? 5 : 15;
    userCooldownExpiresAt = new Date(now.getTime() + cooldownMinutes * 60 * 1000);
    userFirstThrottled = true;
  }

  const userSetDoc = {
    type: 'username',
    keyHash: usernameKeyHash,
    tokens: newUserTokens,
    updatedAt: now,
    expiresAt: ipExpiresAt,
  };
  if (userCooldownExpiresAt) {
    userSetDoc.cooldownExpiresAt = userCooldownExpiresAt;
  }
  if (userLevel > 0) {
    userSetDoc.cooldownLevel = userLevel;
  }
  if (userFirstThrottled || userDoc?.lastDepletedAt) {
    userSetDoc.lastDepletedAt = userFirstThrottled ? now : userDoc.lastDepletedAt;
  }

  await col.updateOne({ _id: userId }, { $set: userSetDoc }, { upsert: true });

  const failureCount = 5 - newUserTokens;
  const delayMs = failureCount === 1 ? 250 : failureCount === 2 ? 500 : failureCount === 3 ? 1000 : 2000;

  return { delayMs, ipFirstThrottled, userFirstThrottled };
}

/**
 * 登录成功后重置用户名限速桶与冷却等级（不重置 IP 桶）。
 *
 * @param {import('mongodb').Db} db
 * @param {string} usernameKeyHash
 * @returns {Promise<void>}
 */
export async function resetUsernameThrottle(db, usernameKeyHash) {
  await db.collection('admin_throttles').deleteOne({ _id: `user:${usernameKeyHash}` });
}
