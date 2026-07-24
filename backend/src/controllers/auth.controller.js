// 管理员认证控制器 — 请求参数提取 -> 调用 Service -> 组装响应
// 禁止在此层出现业务判断逻辑

import { AppError } from "../middlewares/error-handler.middleware.js";
import { login as loginService, recoverSession, logout as logoutService, changePassword as changePasswordService } from "../services/auth.service.js";
import { verifyToken } from "../utils/jwt.js";

/** Cookie 名称 */
const COOKIE_NAME = "admin_session";
/** Cookie 有效期（毫秒）：24 小时 */
const COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * 设置认证 Cookie 的通用选项
 * @param {object} ctx - Koa context
 * @param {number} maxAge - maxAge 毫秒数，0 表示删除
 */
function setAuthCookie(ctx, value, maxAge) {
  ctx.cookies.set(COOKIE_NAME, value, {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    secure: ctx.config.nodeEnv === "production",
    maxAge,
    overwrite: true,
  });
}

/**
 * POST /admin/auth/login
 * 验证登录名和密码，成功时设置 HttpOnly Cookie 并返回认证信息
 */
export async function login(ctx) {
  const { username, password } = ctx.request.body;
  const ip = ctx.ip;

  const result = await loginService({ username, password, ip }, ctx.config.adminJwtSecret, ctx.logger);

  // 设置 HttpOnly Cookie
  setAuthCookie(ctx, result.jwtToken, COOKIE_MAX_AGE_MS);

  ctx.body = {
    admin: result.admin,
    session: result.session,
    serverTime: result.serverTime,
    csrfToken: result.csrfToken,
  };
}

/**
 * GET /admin/auth/session
 * 从 Cookie 中恢复会话，含活动采样和 idle 续期
 * 认证失效时清除 Cookie
 */
export async function session(ctx) {
  const token = ctx.cookies.get(COOKIE_NAME);
  if (!token) {
    throw new AppError("认证已失效，请重新登录", 401, "ADMIN_AUTH_REQUIRED");
  }

  try {
    const result = await recoverSession(token, ctx.config.adminJwtSecret, ctx.logger);

    ctx.body = {
      admin: result.admin,
      session: result.session,
      serverTime: result.serverTime,
      csrfToken: result.csrfToken,
    };
  } catch (err) {
    // 认证失效时清除 Cookie（符合 spec："失效时返回 401 ADMIN_AUTH_REQUIRED 并清除 Cookie"）
    if (err instanceof AppError && err.code === "ADMIN_AUTH_REQUIRED") {
      setAuthCookie(ctx, "", 0);
    }
    throw err;
  }
}

/**
 * POST /admin/auth/logout
 * 验证 CSRF token 和 Origin，删除会话，清除 Cookie
 * 已过期/已删除会话同样返回 204（幂等）
 */
export async function logout(ctx) {
  const token = ctx.cookies.get(COOKIE_NAME);

  // 尝试从 JWT 中解析 sessionId 用于精确删除
  let sessionId = null;
  if (token) {
    try {
      const payload = verifyToken(token, ctx.config.adminJwtSecret);
      sessionId = payload.sid;
    } catch {
      // JWT 过期或无效仍返回 204，因为登出是幂等的
    }
  }

  const csrfToken = ctx.get("X-CSRF-Token") || "";
  const origin = ctx.get("Origin") || "";

  if (sessionId) {
    await logoutService(sessionId, csrfToken, origin, ctx.config.adminWebOrigin, ctx.logger);
  }

  // 清除 Cookie（无论 sessionId 是否存在都执行）
  setAuthCookie(ctx, "", 0);

  ctx.status = 204;
}

/**
 * PATCH /admin/auth/password
 * 验证当前密码后修改为新密码，成功后撤销全部会话并清除 Cookie
 */
export async function changePassword(ctx) {
  const token = ctx.cookies.get(COOKIE_NAME);
  if (!token) {
    throw new AppError("认证已失效，请重新登录", 401, "ADMIN_AUTH_REQUIRED");
  }

  // 从 JWT 中解析 adminId、sessionId 和 sessionGeneration
  let payload;
  try {
    payload = verifyToken(token, ctx.config.adminJwtSecret);
  } catch {
    throw new AppError("认证已失效，请重新登录", 401, "ADMIN_AUTH_REQUIRED");
  }

  const { currentPassword, newPassword } = ctx.request.body;
  const csrfToken = ctx.get("X-CSRF-Token") || "";
  const origin = ctx.get("Origin") || "";

  await changePasswordService(
    {
      adminId: payload.sub,
      sessionId: payload.sid,
      currentPassword,
      newPassword,
      csrfToken,
      origin,
      sessionGeneration: payload.gen,
    },
    ctx.config.adminWebOrigin,
    ctx.logger,
  );

  // 清除认证 Cookie，要求使用新密码重新登录
  setAuthCookie(ctx, "", 0);

  ctx.status = 204;
}
