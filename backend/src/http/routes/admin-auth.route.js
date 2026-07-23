import { randomBytes, randomUUID } from 'node:crypto';

import { appendAuditEvent } from '../../audit/audit-repository.js';
import { findPrimaryAdmin, updatePrimaryAdminPassword } from '../../db/admin-repository.js';
import { createAdminSession, deleteAdminSession, touchAdminSession } from '../../db/session-repository.js';
import { checkLoginThrottle, recordLoginFailure, resetUsernameThrottle } from '../../security/login-throttler.js';
import { signAdminJwt } from '../../security/jwt.js';
import { validatePassword, validateUsername } from '../../security/credential-validator.js';
import { hashPassword, verifyPassword } from '../../security/password-hasher.js';

function readRawBody(req, limit = 8192) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('PAYLOAD_TOO_LARGE'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', reject);
  });
}

/**
 * 管理员认证路由：登录、会话恢复、退出与修改密码接口。
 *
 * @param {{
 *   config: object,
 *   logger: object,
 *   getDb: () => import('mongodb').Db,
 * }} options
 * @returns {import('koa').Middleware}
 */
export function createAdminAuthRoutes({ config, logger, getDb }) {
  return async function adminAuthRoutes(ctx, next) {
    if (!ctx.path.startsWith('/admin/auth/')) {
      await next();
      return;
    }

    const requestId = ctx.state.requestId;
    const cookieName = config.nodeEnv === 'production' ? '__Host-admin_session' : 'admin_session';

    if (ctx.path === '/admin/auth/password') {
      if (ctx.method !== 'PATCH') {
        await next();
        return;
      }

      const contentType = ctx.get('Content-Type') || '';
      if (!contentType.toLowerCase().startsWith('application/json')) {
        ctx.status = 415;
        ctx.body = {
          code: 'UNSUPPORTED_MEDIA_TYPE',
          message: '只接受 application/json 请求',
          requestId,
        };
        return;
      }

      let rawBody;
      try {
        rawBody = await readRawBody(ctx.req, 8192);
      } catch (err) {
        if (err.message === 'PAYLOAD_TOO_LARGE') {
          ctx.status = 413;
          ctx.body = {
            code: 'PAYLOAD_TOO_LARGE',
            message: '请求正文超过上限',
            requestId,
          };
          return;
        }
        throw err;
      }

      let body;
      try {
        body = JSON.parse(rawBody);
      } catch {
        ctx.status = 400;
        ctx.body = {
          code: 'VALIDATION_ERROR',
          message: '请求参数格式错误',
          requestId,
        };
        return;
      }

      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        ctx.status = 400;
        ctx.body = {
          code: 'VALIDATION_ERROR',
          message: '请求参数格式错误',
          requestId,
        };
        return;
      }

      const allowedKeys = new Set(['currentPassword', 'newPassword']);
      const keys = Object.keys(body);
      const hasUnknownKeys = keys.some((k) => !allowedKeys.has(k));
      if (hasUnknownKeys
        || typeof body.currentPassword !== 'string'
        || typeof body.newPassword !== 'string'
        || body.currentPassword.length === 0
        || body.newPassword.length === 0) {
        ctx.status = 400;
        ctx.body = {
          code: 'VALIDATION_ERROR',
          message: '请求参数格式错误',
          requestId,
        };
        return;
      }

      const db = getDb();
      const admin = ctx.state.admin;

      const isCurrentPasswordValid = await verifyPassword(admin.passwordHash, body.currentPassword);
      if (!isCurrentPasswordValid) {
        await appendAuditEvent(
          db,
          {
            eventType: 'ADMIN_PASSWORD_CHANGE',
            outcome: 'failed',
            actorType: 'admin',
            requestId,
            adminId: 'primary-admin',
            reasonCode: 'CURRENT_PASSWORD_INVALID',
            sessionGeneration: admin.sessionGeneration,
          },
          config,
        ).catch((err) => logger.error('审计追加失败', { requestId, errorSummary: err.message }));

        ctx.status = 403;
        ctx.body = {
          code: 'CURRENT_PASSWORD_INVALID',
          message: '当前密码错误',
          requestId,
        };
        return;
      }

      try {
        validatePassword(body.newPassword, admin.username);
      } catch (err) {
        ctx.status = 400;
        ctx.body = {
          code: 'VALIDATION_ERROR',
          message: err.message,
          requestId,
        };
        return;
      }

      const isSamePassword = await verifyPassword(admin.passwordHash, body.newPassword);
      if (isSamePassword) {
        ctx.status = 409;
        ctx.body = {
          code: 'ADMIN_CREDENTIAL_UNCHANGED',
          message: '新密码不能与当前密码相同',
          requestId,
        };
        return;
      }

      const newPasswordHash = await hashPassword(body.newPassword);
      const now = new Date();
      const updateResult = await updatePrimaryAdminPassword(db, {
        expectedGeneration: admin.sessionGeneration,
        newPasswordHash,
        now,
      });

      if (!updateResult.updated) {
        await appendAuditEvent(
          db,
          {
            eventType: 'ADMIN_PASSWORD_CHANGE',
            outcome: 'failed',
            actorType: 'admin',
            requestId,
            adminId: 'primary-admin',
            reasonCode: 'ADMIN_CREDENTIAL_CONFLICT',
            sessionGeneration: admin.sessionGeneration,
          },
          config,
        ).catch((err) => logger.error('审计追加失败', { requestId, errorSummary: err.message }));

        ctx.status = 409;
        ctx.body = {
          code: 'ADMIN_CREDENTIAL_CONFLICT',
          message: '管理员凭据已被并发修改，请重新验证',
          requestId,
        };
        return;
      }

      await appendAuditEvent(
        db,
        {
          eventType: 'ADMIN_PASSWORD_CHANGE',
          outcome: 'succeeded',
          actorType: 'admin',
          requestId,
          adminId: 'primary-admin',
          sessionGeneration: updateResult.newGeneration,
        },
        config,
      ).catch((err) => logger.error('审计追加失败', { requestId, errorSummary: err.message }));

      await appendAuditEvent(
        db,
        {
          eventType: 'ADMIN_SESSION_REVOCATION',
          outcome: 'succeeded',
          actorType: 'admin',
          requestId,
          adminId: 'primary-admin',
          revocationScope: 'all',
          sessionGeneration: updateResult.newGeneration,
        },
        config,
      ).catch((err) => logger.error('审计追加失败', { requestId, errorSummary: err.message }));

      ctx.cookies.set(cookieName, null, {
        path: '/',
        expires: new Date(0),
        overwrite: true,
      });

      ctx.status = 204;
      return;
    }

    if (ctx.path === '/admin/auth/logout') {
      if (ctx.method !== 'POST') {
        await next();
        return;
      }

      const session = ctx.state.adminSession;
      const admin = ctx.state.admin;
      const db = getDb();

      if (session) {
        try {
          await deleteAdminSession(db, session._id);
        } catch (err) {
          logger.error('删除会话失败', { requestId, errorSummary: err.message });
          ctx.status = 503;
          ctx.body = {
            code: 'SERVICE_UNAVAILABLE',
            message: '服务暂时不可用，请稍后再试',
            requestId,
          };
          return;
        }

        await appendAuditEvent(
          db,
          {
            eventType: 'ADMIN_LOGOUT',
            outcome: 'succeeded',
            actorType: 'admin',
            requestId,
            adminId: 'primary-admin',
            sessionId: session._id,
            username: admin.username,
            revocationScope: 'current',
            sessionGeneration: admin.sessionGeneration,
          },
          config,
        ).catch((err) => {
          logger.error('审计追加失败', { requestId, errorSummary: err.message });
        });
      }

      ctx.cookies.set(cookieName, null, {
        path: '/',
        expires: new Date(0),
        overwrite: true,
      });

      ctx.status = 204;
      return;
    }

    if (ctx.path === '/admin/auth/session') {
      if (ctx.method !== 'GET') {
        await next();
        return;
      }

      const contentLength = ctx.get('Content-Length');
      if (contentLength && Number(contentLength) > 0) {
        ctx.status = 400;
        ctx.body = {
          code: 'VALIDATION_ERROR',
          message: 'GET 请求不能包含请求正文',
          requestId,
        };
        return;
      }

      const admin = ctx.state.admin;
      const session = ctx.state.adminSession;
      const jwtPayload = ctx.state.jwtPayload;
      const db = getDb();
      const now = new Date();

      const lastSeenTime = new Date(session.lastSeenAt).getTime();
      const fiveMinutesMs = 5 * 60 * 1000;
      let idleExpiresAt = new Date(session.idleExpiresAt);

      if (now.getTime() - lastSeenTime >= fiveMinutesMs) {
        const absoluteExpiresTime = new Date(session.absoluteExpiresAt).getTime();
        const candidateIdleTime = now.getTime() + 30 * 60 * 1000;
        idleExpiresAt = new Date(Math.min(candidateIdleTime, absoluteExpiresTime));

        await touchAdminSession(db, session._id, now, idleExpiresAt).catch((err) => {
          logger.error('会话滑动延期失败', { requestId, errorSummary: err.message });
        });
      }

      ctx.set('Cache-Control', 'no-store');
      ctx.status = 200;
      ctx.body = {
        admin: {
          id: 'primary-admin',
          username: admin.username,
        },
        session: {
          idleExpiresAt: idleExpiresAt.toISOString(),
          absoluteExpiresAt: new Date(session.absoluteExpiresAt).toISOString(),
        },
        serverTime: now.toISOString(),
        csrfToken: jwtPayload.csrfToken,
      };
      return;
    }

    if (ctx.path !== '/admin/auth/login' || ctx.method !== 'POST') {
      await next();
      return;
    }

    const contentType = ctx.get('Content-Type') || '';
    if (!contentType.toLowerCase().startsWith('application/json')) {
      ctx.status = 415;
      ctx.body = {
        code: 'UNSUPPORTED_MEDIA_TYPE',
        message: '只接受 application/json 请求',
        requestId,
      };
      return;
    }

    let rawBody;
    try {
      rawBody = await readRawBody(ctx.req, 8192);
    } catch (err) {
      if (err.message === 'PAYLOAD_TOO_LARGE') {
        ctx.status = 413;
        ctx.body = {
          code: 'PAYLOAD_TOO_LARGE',
          message: '请求正文超过上限',
          requestId,
        };
        return;
      }
      throw err;
    }

    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      ctx.status = 400;
      ctx.body = {
        code: 'VALIDATION_ERROR',
        message: '请求参数格式错误',
        requestId,
      };
      return;
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      ctx.status = 400;
      ctx.body = {
        code: 'VALIDATION_ERROR',
        message: '请求参数格式错误',
        requestId,
      };
      return;
    }

    const allowedKeys = new Set(['username', 'password']);
    const keys = Object.keys(body);
    const hasUnknownKeys = keys.some((k) => !allowedKeys.has(k));
    if (hasUnknownKeys
      || typeof body.username !== 'string'
      || typeof body.password !== 'string'
      || body.username.trim().length === 0
      || body.password.length === 0) {
      ctx.status = 400;
      ctx.body = {
        code: 'VALIDATION_ERROR',
        message: '请求参数格式错误',
        requestId,
      };
      return;
    }

    const clientIp = ctx.req.socket.remoteAddress || '127.0.0.1';
    const db = getDb();
    const now = new Date();

    const throttleResult = await checkLoginThrottle(db, { ip: clientIp, username: body.username }, config, now);
    if (throttleResult.isThrottled) {
      ctx.status = 429;
      ctx.body = {
        code: 'ADMIN_LOGIN_THROTTLED',
        message: '登录请求过多，请稍后再试',
        requestId,
      };
      return;
    }

    let normalizedUsername;
    try {
      normalizedUsername = validateUsername(body.username);
    } catch {
      normalizedUsername = body.username.trim().toLowerCase();
    }

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
        await appendAuditEvent(
          db,
          {
            eventType: 'ADMIN_LOGIN',
            outcome: 'throttled',
            actorType: 'anonymous',
            requestId,
            username: normalizedUsername,
            sourceIp: clientIp,
          },
          config,
        ).catch((err) => logger.error('审计追加失败', { requestId, errorSummary: err.message }));
      }

      await appendAuditEvent(
        db,
        {
          eventType: 'ADMIN_LOGIN',
          outcome: 'failed',
          actorType: 'anonymous',
          requestId,
          username: normalizedUsername,
          sourceIp: clientIp,
          reasonCode: 'ADMIN_CREDENTIALS_INVALID',
        },
        config,
      ).catch((err) => logger.error('审计追加失败', { requestId, errorSummary: err.message }));

      if (failureRecord.delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, failureRecord.delayMs));
      }

      ctx.status = 401;
      ctx.body = {
        code: 'ADMIN_CREDENTIALS_INVALID',
        message: '登录名或密码错误',
        requestId,
      };
      return;
    }

    await resetUsernameThrottle(db, throttleResult.usernameKeyHash);

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

    await appendAuditEvent(
      db,
      {
        eventType: 'ADMIN_LOGIN',
        outcome: 'succeeded',
        actorType: 'admin',
        requestId,
        adminId: 'primary-admin',
        sessionId: jti,
        username: normalizedUsername,
        sourceIp: clientIp,
        sessionGeneration: admin.sessionGeneration,
      },
      config,
    ).catch((err) => logger.error('审计追加失败', { requestId, errorSummary: err.message }));

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
  };
}
