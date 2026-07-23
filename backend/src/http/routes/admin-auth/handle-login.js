import { randomBytes, randomUUID } from 'node:crypto';

import { findPrimaryAdmin } from '../../../db/admin-repository.js';
import { createAdminSession } from '../../../db/session-repository.js';
import { checkLoginThrottle, recordLoginFailure, resetUsernameThrottle } from '../../../security/login-throttler.js';
import { signAdminJwt } from '../../../security/jwt.js';
import { validateUsername } from '../../../security/credential-validator.js';
import { verifyPassword } from '../../../security/password-hasher.js';
import { parseJsonBody, JsonBodyError } from '../../utils/parse-json-body.js';

/**
 * POST /admin/auth/login 端点处理器。
 *
 * 流程：请求体校验 → 限流检查 → 凭据验证 → 会话创建 → JWT 签发 → Cookie 设置 → 审计。
 *
 * @param {import('koa').Context} ctx
 * @param {{
 *   config: object,
 *   logger: object,
 *   db: import('mongodb').Db,
 *   requestId: string,
 *   cookieName: string,
 *   auditAppend: (event: object) => Promise<void>,
 * }} deps
 */
export async function handleLogin(ctx, { config, logger, db, requestId, cookieName, auditAppend }) {
  let body;
  try {
    body = await parseJsonBody(ctx.req, ctx.get('Content-Type'));
  } catch (err) {
    if (err instanceof JsonBodyError) {
      ctx.status = err.status;
      ctx.body = { code: err.code, message: err.message, requestId };
      return;
    }
    throw err;
  }

  // 字段白名单 + 类型校验
  const allowedKeys = new Set(['username', 'password']);
  const keys = Object.keys(body);
  const hasUnknownKeys = keys.some((k) => !allowedKeys.has(k));
  if (hasUnknownKeys
    || typeof body.username !== 'string'
    || typeof body.password !== 'string'
    || body.username.trim().length === 0
    || body.password.length === 0) {
    ctx.status = 400;
    ctx.body = { code: 'VALIDATION_ERROR', message: '请求参数格式错误', requestId };
    return;
  }

  const clientIp = ctx.req.socket.remoteAddress || '127.0.0.1';
  const now = new Date();

  // 限流检查
  const throttleResult = await checkLoginThrottle(db, { ip: clientIp, username: body.username }, config, now);
  if (throttleResult.isThrottled) {
    ctx.status = 429;
    ctx.body = { code: 'ADMIN_LOGIN_THROTTLED', message: '登录请求过多，请稍后再试', requestId };
    return;
  }

  let normalizedUsername;
  try {
    normalizedUsername = validateUsername(body.username);
  } catch {
    normalizedUsername = body.username.trim().toLowerCase();
  }

  // 凭据验证
  const admin = await findPrimaryAdmin(db);
  const isUsernameMatch = admin && admin.username === normalizedUsername;
  const isPasswordValid = isUsernameMatch ? await verifyPassword(admin.passwordHash, body.password) : false;

  if (!isUsernameMatch || !isPasswordValid) {
    const failureRecord = await recordLoginFailure(
      db,
      { ipKeyHash: throttleResult.ipKeyHash, usernameKeyHash: throttleResult.usernameKeyHash },
      now,
    );

    if (failureRecord.ipFirstThrottled || failureRecord.userFirstThrottled) {
      await auditAppend({
        eventType: 'ADMIN_LOGIN',
        outcome: 'throttled',
        actorType: 'anonymous',
        username: normalizedUsername,
        sourceIp: clientIp,
      });
    }

    await auditAppend({
      eventType: 'ADMIN_LOGIN',
      outcome: 'failed',
      actorType: 'anonymous',
      username: normalizedUsername,
      sourceIp: clientIp,
      reasonCode: 'ADMIN_CREDENTIALS_INVALID',
    });

    if (failureRecord.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, failureRecord.delayMs));
    }

    ctx.status = 401;
    ctx.body = { code: 'ADMIN_CREDENTIALS_INVALID', message: '登录名或密码错误', requestId };
    return;
  }

  await resetUsernameThrottle(db, throttleResult.usernameKeyHash);

  // 会话创建与 JWT 签发
  const jti = randomUUID();
  const csrfToken = randomBytes(32).toString('base64url');
  const idleExpiresAt = new Date(now.getTime() + 30 * 60 * 1000);
  const absoluteExpiresAt = new Date(now.getTime() + 12 * 60 * 60 * 1000);

  const session = await createAdminSession(db, {
    jti,
    sessionGeneration: admin.sessionGeneration,
    csrfToken,
    now,
    idleExpiresAt,
    absoluteExpiresAt,
  });

  const jwt = signAdminJwt(
    {
      jti,
      iat: Math.floor(now.getTime() / 1000),
      exp: Math.floor(absoluteExpiresAt.getTime() / 1000),
      sessionGeneration: admin.sessionGeneration,
      csrfToken,
    },
    config.adminJwtSecret,
  );

  const isProduction = config.nodeEnv === 'production';
  ctx.cookies.set(cookieName, jwt, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/',
    overwrite: true,
  });

  ctx.set('Cache-Control', 'no-store');

  await auditAppend({
    eventType: 'ADMIN_LOGIN',
    outcome: 'succeeded',
    actorType: 'admin',
    adminId: 'primary-admin',
    sessionId: jti,
    username: normalizedUsername,
    sourceIp: clientIp,
    sessionGeneration: admin.sessionGeneration,
  });

  ctx.status = 200;
  ctx.body = {
    admin: {
      id: 'primary-admin',
      username: normalizedUsername,
    },
    session: {
      idleExpiresAt: session.idleExpiresAt.toISOString(),
      absoluteExpiresAt: session.absoluteExpiresAt.toISOString(),
    },
    serverTime: now.toISOString(),
    csrfToken,
  };
}
