// 管理员认证 API 集成测试 — HTTP 契约测试覆盖全部端点、错误码和 Cookie 属性

import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import argon2 from "argon2";
import mongoose from "mongoose";
import { connectTestDb, dropTestDb } from "./helpers/test-db.js";
import Admin from "../src/models/admin.model.js";
import Session from "../src/models/session.model.js";
import { createApp } from "../src/app.js";

// ── 测试常量 ──
const TEST_PASSWORD = "TestPassword123!";
const TEST_USERNAME = "admin-test";

// ── 环境变量（test 模式下跳过密码/来源校验） ──
process.env.NODE_ENV = "test";
process.env.PORT = "0";
process.env.ADMIN_JWT_SECRET = "test-jwt-secret-at-least-16-chars";
process.env.SECURITY_HMAC_SECRET = "test-hmac-secret-at-least-16-chars";
process.env.ADMIN_WEB_ORIGIN = "http://localhost:5173";
process.env.LOG_LEVEL = "fatal";

let dbName;
let baseUrl;
let server;
let adminId;
let app;

before(async () => {
  // 1. 连接测试数据库
  dbName = await connectTestDb();
  process.env.MONGODB_URI = mongoose.connection.host + "/" + dbName;

  // 2. 创建测试管理员（直接用 Mongoose，绕过 HTTP）
  const passwordHash = await argon2.hash(TEST_PASSWORD);
  const admin = await Admin.create({
    username: TEST_USERNAME,
    passwordHash,
  });
  adminId = admin._id;

  // 3. 创建应用并启动服务器
  const created = createApp();
  app = created.app;
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      baseUrl = "http://127.0.0.1:" + addr.port;
      resolve();
    });
  });
});

after(async () => {
  // 关闭服务器
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  // 清理数据库
  await dropTestDb(dbName);
});

// 每个测试前清理会话
beforeEach(async () => {
  await Session.deleteMany({});
});

// ═══════════════════════════════════════════
// POST /admin/auth/login
// ═══════════════════════════════════════════

describe("POST /admin/auth/login", () => {
  it("成功登录返回 200 含 admin、session、serverTime、csrfToken", async () => {
    const res = await fetch(baseUrl + "/admin/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:5173",
      },
      body: JSON.stringify({ username: TEST_USERNAME, password: TEST_PASSWORD }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();

    // 验证响应结构
    assert.ok(body.admin);
    assert.equal(body.admin.username, TEST_USERNAME);
    assert.ok(body.admin.id);
    assert.ok(body.session);
    assert.ok(body.session.id);
    assert.ok(body.session.idleExpiresAt);
    assert.ok(body.session.sessionGeneration);
    assert.ok(body.serverTime);
    assert.ok(body.csrfToken);
    assert.equal(typeof body.csrfToken, "string");
    assert.ok(body.csrfToken.length >= 64);
  });

  it("登录成功设置 HttpOnly Cookie", async () => {
    const res = await fetch(baseUrl + "/admin/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: TEST_USERNAME, password: TEST_PASSWORD }),
    });

    assert.equal(res.status, 200);
    const setCookie = res.headers.getSetCookie();
    assert.ok(setCookie);
    const cookieStr = setCookie.join("; ");
    assert.ok(cookieStr.includes("admin_session="));
    assert.ok(cookieStr.includes("HttpOnly"));
    assert.ok(cookieStr.includes("SameSite=Strict"));
    assert.ok(cookieStr.includes("Path=/"));
  });

  it("响应 Cache-Control: no-store", async () => {
    const res = await fetch(baseUrl + "/admin/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: TEST_USERNAME, password: TEST_PASSWORD }),
    });

    assert.equal(res.headers.get("Cache-Control"), "no-store");
  });

  it("错误凭据返回 401 ADMIN_CREDENTIALS_INVALID（用户名不存在）", async () => {
    const res = await fetch(baseUrl + "/admin/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "nonexistent", password: TEST_PASSWORD }),
    });

    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.code, "ADMIN_CREDENTIALS_INVALID");
    assert.ok(body.message);
    assert.ok(body.requestId);
  });

  it("错误凭据返回 401 ADMIN_CREDENTIALS_INVALID（密码错误）", async () => {
    const res = await fetch(baseUrl + "/admin/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: TEST_USERNAME, password: "WrongPassword!" }),
    });

    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.code, "ADMIN_CREDENTIALS_INVALID");
  });

  it("不区分用户名不存在和密码错误", async () => {
    const res1 = await fetch(baseUrl + "/admin/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "nonexistent", password: TEST_PASSWORD }),
    });
    const res2 = await fetch(baseUrl + "/admin/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: TEST_USERNAME, password: "wrong" }),
    });

    assert.equal(res1.status, 401);
    assert.equal(res2.status, 401);
    const b1 = await res1.json();
    const b2 = await res2.json();
    assert.equal(b1.code, "ADMIN_CREDENTIALS_INVALID");
    assert.equal(b2.code, "ADMIN_CREDENTIALS_INVALID");
  });

  it("缺少 username 返回错误", async () => {
    const res = await fetch(baseUrl + "/admin/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: TEST_PASSWORD }),
    });

    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.code, "ADMIN_CREDENTIALS_INVALID");
  });

  it("X-Request-ID 存在", async () => {
    const res = await fetch(baseUrl + "/admin/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: TEST_USERNAME, password: TEST_PASSWORD }),
    });

    const id = res.headers.get("X-Request-ID");
    assert.ok(id);
    assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });
});

// ═══════════════════════════════════════════
// 登录限速
// ═══════════════════════════════════════════

describe("登录限速", () => {
  it("连续 5 次失败后触发 429 ADMIN_LOGIN_THROTTLED", async () => {
    // 5 次失败（第 5 次刚好触发限速）
    for (let i = 0; i < 5; i++) {
      await fetch(baseUrl + "/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "ratelimit-test", password: "wrong" }),
      });
    }

    // 第 6 次应被限速
    const res = await fetch(baseUrl + "/admin/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "ratelimit-test", password: "wrong" }),
    });

    assert.equal(res.status, 429);
    const body = await res.json();
    assert.equal(body.code, "ADMIN_LOGIN_THROTTLED");
  });

  it("429 响应不暴露阈值或剩余时间", async () => {
    // 触发限速
    for (let i = 0; i < 6; i++) {
      await fetch(baseUrl + "/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "no-leak-test", password: "wrong" }),
      });
    }

    const res = await fetch(baseUrl + "/admin/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "no-leak-test", password: "wrong" }),
    });

    const body = await res.json();
    // message 不应包含数字阈值
    assert.ok(!/\d+/.test(body.message));
    // 不应有 Retry-After 等泄露信息的头
    assert.equal(res.headers.get("Retry-After"), null);
  });
});

// ═══════════════════════════════════════════
// GET /admin/auth/session
// ═══════════════════════════════════════════

describe("GET /admin/auth/session", () => {
  /** 辅助：登录并返回 cookie 字符串 */
  async function loginAndGetCookie() {
    const res = await fetch(baseUrl + "/admin/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: TEST_USERNAME, password: TEST_PASSWORD }),
    });
    const setCookie = res.headers.getSetCookie();
    return setCookie.join("; ");
  }

  it("有效 Cookie 恢复会话成功返回 200", async () => {
    const cookie = await loginAndGetCookie();

    const res = await fetch(baseUrl + "/admin/auth/session", {
      headers: { Cookie: cookie },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.admin);
    assert.equal(body.admin.username, TEST_USERNAME);
    assert.ok(body.session);
    assert.ok(body.csrfToken);
    assert.ok(body.serverTime);
  });

  it("无 Cookie 返回 401 ADMIN_AUTH_REQUIRED", async () => {
    const res = await fetch(baseUrl + "/admin/auth/session");

    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.code, "ADMIN_AUTH_REQUIRED");
    assert.ok(body.requestId);
  });

  it("无效 JWT 返回 401", async () => {
    const res = await fetch(baseUrl + "/admin/auth/session", {
      headers: { Cookie: "admin_session=invalid.jwt.token" },
    });

    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.code, "ADMIN_AUTH_REQUIRED");
  });

  it("Cache-Control: no-store", async () => {
    const cookie = await loginAndGetCookie();
    const res = await fetch(baseUrl + "/admin/auth/session", {
      headers: { Cookie: cookie },
    });

    assert.equal(res.headers.get("Cache-Control"), "no-store");
  });

  it("sessionGeneration 不匹配时返回 401 并清除 Cookie", async () => {
    const cookie = await loginAndGetCookie();

    // 手动递增 sessionGeneration 使会话失效
    await Admin.findByIdAndUpdate(adminId, { $inc: { sessionGeneration: 1 } });

    const res = await fetch(baseUrl + "/admin/auth/session", {
      headers: { Cookie: cookie },
    });

    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.code, "ADMIN_AUTH_REQUIRED");
  });
});

// ═══════════════════════════════════════════
// POST /admin/auth/logout
// ═══════════════════════════════════════════

describe("POST /admin/auth/logout", () => {
  /** 辅助：登录并返回 { cookie, csrfToken } */
  async function loginAndGetAuth() {
    const res = await fetch(baseUrl + "/admin/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: TEST_USERNAME, password: TEST_PASSWORD }),
    });
    const body = await res.json();
    const cookie = res.headers.getSetCookie().join("; ");
    return { cookie, csrfToken: body.csrfToken };
  }

  it("有效 CSRF token 登出成功返回 204", async () => {
    const { cookie, csrfToken } = await loginAndGetAuth();

    const res = await fetch(baseUrl + "/admin/auth/logout", {
      method: "POST",
      headers: {
        Cookie: cookie,
        "X-CSRF-Token": csrfToken,
        Origin: "http://localhost:5173",
      },
    });

    assert.equal(res.status, 204);
  });

  it("登出后清除 Cookie（maxAge=0）", async () => {
    const { cookie, csrfToken } = await loginAndGetAuth();

    const res = await fetch(baseUrl + "/admin/auth/logout", {
      method: "POST",
      headers: {
        Cookie: cookie,
        "X-CSRF-Token": csrfToken,
        Origin: "http://localhost:5173",
      },
    });

    const setCookie = res.headers.getSetCookie();
    assert.ok(setCookie);
    const clearCookie = setCookie.join("; ");
    assert.ok(clearCookie.includes("admin_session="));
    // maxAge=0 表示删除
  });

  it("登出后会话不可恢复", async () => {
    const { cookie, csrfToken } = await loginAndGetAuth();

    // 先登出
    await fetch(baseUrl + "/admin/auth/logout", {
      method: "POST",
      headers: {
        Cookie: cookie,
        "X-CSRF-Token": csrfToken,
        Origin: "http://localhost:5173",
      },
    });

    // 再尝试恢复会话
    const res = await fetch(baseUrl + "/admin/auth/session", {
      headers: { Cookie: cookie },
    });

    assert.equal(res.status, 401);
    assert.equal((await res.json()).code, "ADMIN_AUTH_REQUIRED");
  });

  it("CSRF token 错误返回 403，不撤销会话", async () => {
    const { cookie } = await loginAndGetAuth();

    const res = await fetch(baseUrl + "/admin/auth/logout", {
      method: "POST",
      headers: {
        Cookie: cookie,
        "X-CSRF-Token": "wrong-csrf-token",
        Origin: "http://localhost:5173",
      },
    });

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.code, "CSRF_VALIDATION_FAILED");

    // 会话仍有效
    const sessionRes = await fetch(baseUrl + "/admin/auth/session", {
      headers: { Cookie: cookie },
    });
    assert.equal(sessionRes.status, 200);
  });

  it("缺失 CSRF token 返回 403", async () => {
    const { cookie } = await loginAndGetAuth();

    const res = await fetch(baseUrl + "/admin/auth/logout", {
      method: "POST",
      headers: {
        Cookie: cookie,
        Origin: "http://localhost:5173",
      },
      // 不发送 X-CSRF-Token
    });

    assert.equal(res.status, 403);
    assert.equal((await res.json()).code, "CSRF_VALIDATION_FAILED");
  });

  it("Origin 不匹配返回 403", async () => {
    const { cookie, csrfToken } = await loginAndGetAuth();

    const res = await fetch(baseUrl + "/admin/auth/logout", {
      method: "POST",
      headers: {
        Cookie: cookie,
        "X-CSRF-Token": csrfToken,
        Origin: "http://evil.com",
      },
    });

    assert.equal(res.status, 403);
    assert.equal((await res.json()).code, "CSRF_VALIDATION_FAILED");
  });

  it("已过期/已删除会话登出仍返回 204（幂等）", async () => {
    const { cookie, csrfToken } = await loginAndGetAuth();

    // 手动删除所有会话
    await Session.deleteMany({});

    const res = await fetch(baseUrl + "/admin/auth/logout", {
      method: "POST",
      headers: {
        Cookie: cookie,
        "X-CSRF-Token": csrfToken,
        Origin: "http://localhost:5173",
      },
    });

    assert.equal(res.status, 204);
  });

  it("Cache-Control: no-store", async () => {
    const { cookie, csrfToken } = await loginAndGetAuth();

    const res = await fetch(baseUrl + "/admin/auth/logout", {
      method: "POST",
      headers: {
        Cookie: cookie,
        "X-CSRF-Token": csrfToken,
        Origin: "http://localhost:5173",
      },
    });

    assert.equal(res.headers.get("Cache-Control"), "no-store");
  });
});

// ═══════════════════════════════════════════
// 统一错误格式校验
// ═══════════════════════════════════════════

describe("统一错误响应格式", () => {
  it("错误响应包含 { code, message, requestId }", async () => {
    const res = await fetch(baseUrl + "/admin/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "x", password: "x" }),
    });

    assert.ok(res.status >= 400);
    const body = await res.json();
    assert.ok("code" in body);
    assert.ok("message" in body);
    assert.ok("requestId" in body);
    assert.equal(typeof body.code, "string");
    assert.equal(typeof body.message, "string");
    assert.equal(typeof body.requestId, "string");
  });
});
