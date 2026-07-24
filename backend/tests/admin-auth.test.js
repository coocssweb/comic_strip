// 管理员 JWT 鉴权中间件测试 — 验证 token 校验、401 响应和 ctx.state.admin 挂载

import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import argon2 from "argon2";
import mongoose from "mongoose";
import { connectTestDb, dropTestDb } from "./helpers/test-db.js";
import Admin from "../src/models/admin.model.js";
import Session from "../src/models/session.model.js";
// 直接使用 jsonwebtoken 签发可控的 token
import jwt from "jsonwebtoken";
import { createApp } from "../src/app.js";

// ── 测试常量 ──
const TEST_PASSWORD = "TestPassword123!";
const TEST_USERNAME = "admin-auth-test";
const JWT_SECRET = "test-jwt-secret-at-least-16-chars";
// 创建一个带 admin-auth 中间件的受保护路由来测试
const PROTECTED_PATH = "/api/v1/test-protected";

process.env.NODE_ENV = "test";
process.env.PORT = "0";
process.env.ADMIN_JWT_SECRET = JWT_SECRET;
process.env.SECURITY_HMAC_SECRET = "test-hmac-secret-at-least-16-chars";
process.env.ADMIN_WEB_ORIGIN = "http://localhost:5173";
process.env.LOG_LEVEL = "fatal";

let dbName;
let baseUrl;
let server;
let app;

before(async () => {
  dbName = await connectTestDb();
  // 从连接 URI 中提取协议和认证信息，替换为测试数据库名
  const connUri = new URL(mongoose.connection.client.s.url);
  connUri.pathname = "/" + dbName;
  process.env.MONGODB_URI = connUri.toString();

  // 创建测试管理员
  const passwordHash = await argon2.hash(TEST_PASSWORD);
  await Admin.create({ username: TEST_USERNAME, passwordHash });

  const created = createApp();
  app = created.app;

  // 注入受保护路由用于测试管理员鉴权中间件
  const { createAdminAuthMiddleware } = await import(
    "../src/middlewares/admin-auth.middleware.js"
  );
  const adminAuth = createAdminAuthMiddleware(created.config);

  const Router = (await import("@koa/router")).default;
  const testRouter = new Router();
  testRouter.get(PROTECTED_PATH, adminAuth, (ctx) => {
    ctx.body = { admin: ctx.state.admin };
  });
  app.use(testRouter.routes());
  app.use(testRouter.allowedMethods());

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      baseUrl = "http://127.0.0.1:" + addr.port;
      resolve();
    });
  });
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await dropTestDb(dbName);
});

beforeEach(async () => {
  await Session.deleteMany({});
});

// ═══════════════════════════════════════════
// admin-auth 中间件行为
// ═══════════════════════════════════════════

describe("管理员鉴权中间件", () => {
  /** 辅助：登录并返回 cookie 字符串 */
  async function loginAndGetCookie() {
    const res = await fetch(baseUrl + "/admin/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: TEST_USERNAME, password: TEST_PASSWORD }),
    });
    return res.headers.getSetCookie().join("; ");
  }

  it("有效 token 放行并返回 200，ctx.state.admin 包含 decoded payload", async () => {
    const cookie = await loginAndGetCookie();

    const res = await fetch(baseUrl + PROTECTED_PATH, {
      headers: { Cookie: cookie },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.admin);
    // koa-jwt 挂载的 decoded payload 应包含标准 JWT 字段
    assert.ok(body.admin.sub);
    assert.ok(body.admin.iat);
    assert.ok(body.admin.exp);
  });

  it("缺失 Cookie 返回 401 ADMIN_AUTH_REQUIRED", async () => {
    const res = await fetch(baseUrl + PROTECTED_PATH);

    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.code, "ADMIN_AUTH_REQUIRED");
    assert.ok(body.message);
    assert.ok(body.requestId);
  });

  it("无效 JWT（格式错误）返回 401 ADMIN_AUTH_REQUIRED", async () => {
    const res = await fetch(baseUrl + PROTECTED_PATH, {
      headers: { Cookie: "admin_session=not.a.valid.jwt" },
    });

    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.code, "ADMIN_AUTH_REQUIRED");
  });

  it("过期 JWT 返回 401 ADMIN_AUTH_REQUIRED", async () => {
    // 签发一个已过期的 token
    const expiredToken = jwt.sign(
      { sub: "test-admin-id", sid: "test-session-id", gen: 1 },
      JWT_SECRET,
      { issuer: "comic-strip-admin", expiresIn: "-1s" },
    );

    const res = await fetch(baseUrl + PROTECTED_PATH, {
      headers: { Cookie: "admin_session=" + expiredToken },
    });

    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.code, "ADMIN_AUTH_REQUIRED");
  });

  it("错误签名 JWT 返回 401 ADMIN_AUTH_REQUIRED", async () => {
    // 用不同密钥签发的 token
    const wrongSecretToken = jwt.sign(
      { sub: "test-admin-id", sid: "test-session-id", gen: 1 },
      "wrong-secret-key-that-does-not-match",
      { issuer: "comic-strip-admin", expiresIn: "1h" },
    );

    const res = await fetch(baseUrl + PROTECTED_PATH, {
      headers: { Cookie: "admin_session=" + wrongSecretToken },
    });

    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.code, "ADMIN_AUTH_REQUIRED");
  });

  it("错误 issuer JWT 返回 401", async () => {
    const wrongIssuerToken = jwt.sign(
      { sub: "test-admin-id", sid: "test-session-id", gen: 1 },
      JWT_SECRET,
      { issuer: "wrong-issuer", expiresIn: "1h" },
    );

    const res = await fetch(baseUrl + PROTECTED_PATH, {
      headers: { Cookie: "admin_session=" + wrongIssuerToken },
    });

    assert.equal(res.status, 401);
  });

  it("响应包含 X-Request-ID", async () => {
    const res = await fetch(baseUrl + PROTECTED_PATH);

    const id = res.headers.get("X-Request-ID");
    assert.ok(id);
    assert.match(
      id,
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});
