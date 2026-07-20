import { hashSessionToken, verifySessionToken } from '../auth/session-token.js';
import { env } from '../config/env.js';
import { Session } from '../models/session.model.js';
import { ApiError } from '../utils/api-error.js';

function getBearerToken(authorization) {
  if (typeof authorization !== 'string') {
    return null;
  }

  const match = /^Bearer ([^\s]+)$/.exec(authorization);
  return match ? match[1] : null;
}

function createAuthenticationError(expectedRole) {
  if (expectedRole === 'admin') {
    return new ApiError(401, 'ADMIN_AUTH_REQUIRED', '请先登录管理后台。');
  }

  return new ApiError(401, 'READER_AUTH_REQUIRED', '请先微信登录后再操作。');
}

function authenticate(expectedRole, { optional = false } = {}) {
  return async (ctx, next) => {
    const token = getBearerToken(ctx.get('authorization'));
    const session =
      token &&
      verifySessionToken({
        token,
        expectedRole,
        secret: env.sessionSecret,
        now: new Date(),
      });

    if (!session && optional) {
      await next();
      return;
    }

    if (!session) {
      throw createAuthenticationError(expectedRole);
    }

    const tokenDigest = hashSessionToken(token);
    const activeSession = await Session.exists({
      tokenDigest,
      role: session.role,
      subjectId: session.subjectId,
      expiresAt: { $gt: new Date() },
      revokedAt: null,
    });

    if (!activeSession && optional) {
      await next();
      return;
    }

    if (!activeSession) {
      throw createAuthenticationError(expectedRole);
    }

    ctx.state.auth = session;
    ctx.state.sessionTokenDigest = tokenDigest;
    await next();
  };
}

export const requireReaderAuth = authenticate('reader');
export const requireAdminAuth = authenticate('admin');
export const requireAuthenticated = authenticate(undefined);
export const optionalReaderAuth = authenticate('reader', { optional: true });
