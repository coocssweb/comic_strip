import bcrypt from 'bcryptjs';
import { createSessionToken, hashSessionToken } from '../auth/session-token.js';
import { env } from '../config/env.js';
import { Reader } from '../models/reader.model.js';
import { Session } from '../models/session.model.js';
import { ApiError } from '../utils/api-error.js';

function toReaderResponse(reader) {
  return {
    id: reader.id,
    displayName: reader.displayName,
    avatarUrl: reader.avatarUrl,
    createdAt: reader.createdAt.toISOString(),
  };
}

async function exchangeWechatCode(code) {
  const requestUrl = new URL('https://api.weixin.qq.com/sns/jscode2session');
  requestUrl.search = new URLSearchParams({
    appid: env.wechatAppId,
    secret: env.wechatAppSecret,
    js_code: code,
    grant_type: 'authorization_code',
  }).toString();

  try {
    const response = await fetch(requestUrl);
    const payload = await response.json();

    return response.ok && typeof payload.openid === 'string' && payload.openid
      ? payload.openid
      : null;
  } catch {
    return null;
  }
}

async function issueSession({ subjectId, role }) {
  const expiresAt = new Date(Date.now() + env.sessionExpiresSeconds * 1000);
  const sessionToken = createSessionToken({
    subjectId,
    role,
    expiresAt,
    secret: env.sessionSecret,
  });

  await Session.create({
    tokenDigest: hashSessionToken(sessionToken),
    role,
    subjectId,
    expiresAt,
  });

  return { sessionToken, expiresAt: expiresAt.toISOString() };
}

export async function loginWithWechat(ctx) {
  const { code, profile } = ctx.request.body;
  const wechatOpenId = await exchangeWechatCode(code);

  if (!wechatOpenId) {
    throw new ApiError(401, 'WECHAT_LOGIN_FAILED', '微信登录已失效，请重新登录。');
  }

  const readerUpdate = { lastLoginAt: new Date() };

  if (profile) {
    readerUpdate.displayName = profile.displayName;
    readerUpdate.avatarUrl = profile.avatarUrl;
  }

  const reader = await Reader.findOneAndUpdate(
    { wechatOpenId },
    { $set: readerUpdate, $setOnInsert: { wechatOpenId } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );
  const session = await issueSession({ subjectId: reader.id, role: 'reader' });

  ctx.ok({ reader: toReaderResponse(reader), ...session });
}

export async function loginAsAdmin(ctx) {
  const { username, password } = ctx.request.body;
  const passwordMatches = await bcrypt.compare(password, env.adminPasswordHash);

  if (username !== env.adminUsername || !passwordMatches) {
    throw new ApiError(401, 'ADMIN_LOGIN_FAILED', '账号或密码错误。');
  }

  const session = await issueSession({ subjectId: env.adminUsername, role: 'admin' });
  ctx.ok({ admin: { username: env.adminUsername }, ...session });
}

export async function logout(ctx) {
  await Session.updateOne(
    {
      tokenDigest: ctx.state.sessionTokenDigest,
      role: ctx.state.auth.role,
      subjectId: ctx.state.auth.subjectId,
      revokedAt: null,
    },
    { $set: { revokedAt: new Date() } },
  );
  ctx.ok({});
}
