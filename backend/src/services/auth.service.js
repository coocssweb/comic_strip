// 管理员认证服务 — 承载登录、会话恢复、登出的全部业务规则
// 禁止访问 ctx / req / res，保证可脱离 HTTP 环境单测

import argon2 from "argon2";
import { AppError } from "../middlewares/error-handler.middleware.js";
import { findByUsername, findById as findAdminById } from "../repositories/admin.repository.js";
import {
  create as createSession,
  findById as findSessionById,
  remove as removeSession,
  extendIdleExpiresAt,
} from "../repositories/session.repository.js";
import { signToken, verifyToken } from "../utils/jwt.js";
import { generateCsrfToken } from "../utils/csrf.js";

// ── 会话时间常量 ──
/** JWT 绝对过期时间（秒）：24 小时 */
const SESSION_DURATION_SEC = 24 * 60 * 60;
/** 空闲超时（毫秒）：30 分钟 */
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
/** 活动采样间隔（毫秒）：5 分钟 */
const ACTIVITY_SAMPLING_MS = 5 * 60 * 1000;

// ── 登录限速常量 ──
/** 限速窗口（毫秒）：15 分钟 */
const RATE_WINDOW_MS = 15 * 60 * 1000;
/** 窗口内最大尝试次数 */
const RATE_MAX_ATTEMPTS = 5;

/** 内存限速存储：key -> [{timestamp}, ...] */
const rateStore = new Map();

// ── 登录限速 ──

/**
 * 检查指定 IP 和登录名的限速状态
 * 同时检查 IP 桶和用户名桶，任一触发即拒绝
 * @param {string} ip - 来源 IP
 * @param {string} username - 登录名
 * @throws {AppError} 触发限速时抛出 429 ADMIN_LOGIN_THROTTLED
 */
function checkRateLimit(ip, username) {
  const now = Date.now();
  const windowStart = now - RATE_WINDOW_MS;

  const ipKey = "ip:" + ip;
  const ipHits = pruneAndCount(ipKey, windowStart);
  if (ipHits >= RATE_MAX_ATTEMPTS) {
    throw new AppError("登录请求过于频繁，请稍后再试", 429, "ADMIN_LOGIN_THROTTLED");
  }

  const userKey = "user:" + username;
  const userHits = pruneAndCount(userKey, windowStart);
  if (userHits >= RATE_MAX_ATTEMPTS) {
    throw new AppError("登录请求过于频繁，请稍后再试", 429, "ADMIN_LOGIN_THROTTLED");
  }

  recordHit(ipKey, now);
  recordHit(userKey, now);
}

/** 清理过期记录并返回有效计数 */
function pruneAndCount(key, windowStart) {
  const hits = rateStore.get(key);
  if (!hits) return 0;
  const valid = hits.filter((t) => t > windowStart);
  rateStore.set(key, valid);
  return valid.length;
}

/** 记录一次命中 */
function recordHit(key, now) {
  const hits = rateStore.get(key) || [];
  hits.push(now);
  rateStore.set(key, hits);
}

// ── 登录 ──

/**
 * 管理员登录
 * 验证凭据 -> 创建会话 -> 签发 JWT -> 返回认证信息
 *
 * @param {{ username: string, password: string, ip: string }} params
 * @param {string} jwtSecret - JWT 签名密钥
 * @param {object} [logger] - 可选 logger，用于审计日志
 * @returns {Promise<{ admin: object, session: object, serverTime: string, csrfToken: string, jwtToken: string, sessionId: string }>}
 */
export async function login({ username, password, ip }, jwtSecret, logger) {
  // 1. 登录限速检查
  // 规范化用户名（去除首尾空白，与 Model 层 trim 一致）
  const normalizedUsername = (username || '').trim();
  if (!normalizedUsername || !password) {
    throw new AppError('登录名或密码错误', 401, 'ADMIN_CREDENTIALS_INVALID');
  }

  checkRateLimit(ip, normalizedUsername);

  // 2. 查找管理员
  const admin = await findByUsername(normalizedUsername);
  if (!admin) {
    throw new AppError("登录名或密码错误", 401, "ADMIN_CREDENTIALS_INVALID");
  }

  // 3. 验证密码
  let passwordValid = false;
  try {
    passwordValid = await argon2.verify(admin.passwordHash, password);
  } catch {
    // argon2 内部错误（如哈希格式异常），同样返回凭据无效，不暴露细节
  }

  if (!passwordValid) {
    throw new AppError("登录名或密码错误", 401, "ADMIN_CREDENTIALS_INVALID");
  }

  // 4. 生成 CSRF token 和会话时间
  const csrfToken = generateCsrfToken();
  const now = new Date();
  const idleExpiresAt = new Date(now.getTime() + IDLE_TIMEOUT_MS);

  // 5. 创建会话记录
  const session = await createSession({
    adminId: admin._id,
    csrfToken,
    sessionGeneration: admin.sessionGeneration,
    idleExpiresAt,
  });

  // 6. 签发 JWT
  const jwtToken = signToken(
    { sub: admin._id, sid: session._id, gen: admin.sessionGeneration },
    jwtSecret,
    SESSION_DURATION_SEC,
  );

  // 7. 审计日志（不含密码、JWT、CSRF token）
  if (logger) {
    logger.info({
      event: "admin_login_success",
      adminId: admin._id,
      username: admin.username,
      sessionId: session._id,
      ip,
    });
  }

  // 8. 返回认证信息
  return {
    admin: { id: admin._id, username: admin.username },
    session: {
      id: session._id,
      idleExpiresAt: idleExpiresAt.toISOString(),
      sessionGeneration: admin.sessionGeneration,
    },
    serverTime: now.toISOString(),
    csrfToken,
    jwtToken,
    sessionId: session._id,
  };
}

// ── 会话恢复 ──

/**
 * 从 cookie 中恢复管理员会话
 * 验证 JWT -> 检查会话记录 -> 检查 sessionGeneration -> 活动采样续期
 *
 * @param {string} token - cookie 中的 JWT
 * @param {string} jwtSecret - JWT 签名密钥
 * @param {object} [logger] - 可选 logger
 * @returns {Promise<{ admin: object, session: object, serverTime: string, csrfToken: string }>}
 */
export async function recoverSession(token, jwtSecret, logger) {
  // 1. 验证 JWT
  let payload;
  try {
    payload = verifyToken(token, jwtSecret);
  } catch {
    throw new AppError("认证已失效，请重新登录", 401, "ADMIN_AUTH_REQUIRED");
  }

  // 2. 查找会话记录（区分 MongoDB 不可用与服务端错误）
  let sessionRecord;
  try {
    sessionRecord = await findSessionById(payload.sid);
  } catch {
    throw new AppError("服务暂时不可用", 503, "SERVICE_UNAVAILABLE");
  }

  if (!sessionRecord) {
    throw new AppError("认证已失效，请重新登录", 401, "ADMIN_AUTH_REQUIRED");
  }

  // 3. 检查 sessionGeneration 匹配（管理员密码变更后旧会话失效）
  if (sessionRecord.sessionGeneration !== payload.gen) {
    throw new AppError("认证已失效，请重新登录", 401, "ADMIN_AUTH_REQUIRED");
  }

  // 4. 检查空闲是否过期
  const now = new Date();
  if (new Date(sessionRecord.idleExpiresAt) < now) {
    throw new AppError("认证已失效，请重新登录", 401, "ADMIN_AUTH_REQUIRED");
  }

  // 5. 活动采样：距上次续期超过 5 分钟时才延长 idleExpiresAt
  const updatedAt = new Date(sessionRecord.updatedAt);
  if (now.getTime() - updatedAt.getTime() > ACTIVITY_SAMPLING_MS) {
    const newIdleExpiresAt = new Date(now.getTime() + IDLE_TIMEOUT_MS);
    // CAS 更新，忽略并发冲突（冲突时维持原 expiry）
    const extended = await extendIdleExpiresAt(
      payload.sid,
      newIdleExpiresAt,
      sessionRecord.idleExpiresAt,
    );
    if (extended) {
      sessionRecord.idleExpiresAt = newIdleExpiresAt;
    }
  }

  // 6. 查找管理员信息
  const admin = await findAdminById(payload.sub);
  if (!admin) {
    throw new AppError("认证已失效，请重新登录", 401, "ADMIN_AUTH_REQUIRED");
  }

  return {
    admin: { id: admin._id, username: admin.username },
    session: {
      id: sessionRecord._id,
      idleExpiresAt: new Date(sessionRecord.idleExpiresAt).toISOString(),
      sessionGeneration: admin.sessionGeneration,
    },
    serverTime: now.toISOString(),
    csrfToken: sessionRecord.csrfToken,
  };
}

// ── 登出 ──

/**
 * 管理员登出
 * 验证 CSRF token -> 删除会话记录
 *
 * @param {string} sessionId - 会话 ID（来自 JWT payload.sid）
 * @param {string} csrfToken - 请求中的 CSRF token
 * @param {string} origin - 请求 Origin 头
 * @param {string} expectedOrigin - 配置的允许来源
 * @param {object} [logger] - 可选 logger
 */
export async function logout(sessionId, csrfToken, origin, expectedOrigin, logger) {
  // 1. 验证 Origin 头
  if (!origin || origin !== expectedOrigin) {
    throw new AppError("CSRF 校验失败", 403, "CSRF_VALIDATION_FAILED");
  }

  // 2. 查找会话并验证 CSRF token
  let sessionRecord;
  try {
    sessionRecord = await findSessionById(sessionId);
  } catch {
    throw new AppError("服务暂时不可用", 503, "SERVICE_UNAVAILABLE");
  }

  if (!sessionRecord || sessionRecord.csrfToken !== csrfToken) {
    throw new AppError("CSRF 校验失败", 403, "CSRF_VALIDATION_FAILED");
  }

  // 3. 删除会话记录（幂等）
  await removeSession(sessionId);

  // 4. 审计日志
  if (logger) {
    logger.info({
      event: "admin_logout_success",
      adminId: sessionRecord.adminId,
      sessionId,
    });
  }
}
