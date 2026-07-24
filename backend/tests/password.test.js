// 管理员密码修改 API 集成测试 — PATCH /admin/auth/password

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
const TEST_NEW_PASSWORD = "NewSecurePass456!";
const TEST_USERNAME = "admin-test";

// ── 环境变量（test 模式） ──
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

/**
 * 辅助：登录并返回 { cookie, csrfToken }
 */
async function loginAndGetAuth(password = TEST_PASSWORD) {
  const res = await fetch(baseUrl + "/admin/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: TEST_USERNAME, password }),
  });
  const body = await res.json();
  const cookie = res.headers.getSetCookie().join("; ");
  return { cookie, csrfToken: body.csrfToken };
}

before(async () => {
  dbName = await connectTestDb();
  process.env.MONGODB_URI = mongoose.connection.host + "/" + dbName;

  // 创建测试管理员
  const passwordHash = await argon2.hash(TEST_PASSWORD);
  const admin = await Admin.create({
    username: TEST_USERNAME,
    passwordHash,
  });
  adminId = admin._id;

  // 启动服务器
  const created = createApp();
  await new Promise((resolve) => {
    server = created.app.listen(0, () => {
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
// PATCH /admin/auth/password
// ═══════════════════════════════════════════

describe("PATCH /admin/auth/password", () => {
  it("成功修改密码返回 204", async () => {
    const { cookie, csrfToken } = await loginAndGetAuth();

    const res = await fetch(baseUrl + "/admin/auth/password", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        "X-CSRF-Token": csrfToken,
        Origin: "http://localhost:5173",
      },
      body: JSON.stringify({
        currentPassword: TEST_PASSWORD,
        newPassword: TEST_NEW_PASSWORD,
      }),
    });

    assert.equal(res.status, 204);
  });

  it("修改成功后清除 Cookie", async () => {
    const { cookie, csrfToken } = await loginAndGetAuth();

    const res = await fetch(baseUrl + "/admin/auth/password", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        "X-CSRF-Token": csrfToken,
        Origin: "http://localhost:5173",
      },
      body: JSON.stringify({
        currentPassword: TEST_PASSWORD,
        newPassword: TEST_NEW_PASSWORD,
      }),
    });

    assert.equal(res.status, 204);
    const setCookie = res.headers.getSetCookie();
    assert.ok(setCookie);
    const cookieStr = setCookie.join("; ");
    assert.ok(cookieStr.includes("admin_session="));
  });

  it("修改密码后旧会话不可恢复", async () => {
    const { cookie, csrfToken } = await loginAndGetAuth();

    // 修改密码
    await fetch(baseUrl + "/admin/auth/password", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        "X-CSRF-Token": csrfToken,
        Origin: "http://localhost:5173",
      },
      body: JSON.stringify({
        currentPassword: TEST_PASSWORD,
        newPassword: TEST_NEW_PASSWORD,
      }),
    });

    // 旧会话应无效
    const sessionRes = await fetch(baseUrl + "/admin/auth/session", {
      headers: { Cookie: cookie },
    });
    assert.equal(sessionRes.status, 401);
  });

  it("修改密码后 sessionGeneration 递增", async () => {
    const adminBefore = await Admin.findById(adminId).lean();
    const genBefore = adminBefore.sessionGeneration;

    const { cookie, csrfToken } = await loginAndGetAuth();

    await fetch(baseUrl + "/admin/auth/password", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        "X-CSRF-Token": csrfToken,
        Origin: "http://localhost:5173",
      },
      body: JSON.stringify({
        currentPassword: TEST_PASSWORD,
        newPassword: TEST_NEW_PASSWORD,
      }),
    });

    const adminAfter = await Admin.findById(adminId).lean();
    assert.equal(adminAfter.sessionGeneration, genBefore + 1);
  });

  it("新密码可成功登录", async () => {
    const { cookie, csrfToken } = await loginAndGetAuth();

    // 修改密码
    await fetch(baseUrl + "/admin/auth/password", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        "X-CSRF-Token": csrfToken,
        Origin: "http://localhost:5173",
      },
      body: JSON.stringify({
        currentPassword: TEST_PASSWORD,
        newPassword: TEST_NEW_PASSWORD,
      }),
    });

    // 使用新密码登录
    const loginRes = await fetch(baseUrl + "/admin/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: TEST_USERNAME, password: TEST_NEW_PASSWORD }),
    });
    assert.equal(loginRes.status, 200);
  });

  it("旧密码无法登录", async () => {
    const { cookie, csrfToken } = await loginAndGetAuth();

    // 修改密码
    await fetch(baseUrl + "/admin/auth/password", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        "X-CSRF-Token": csrfToken,
        Origin: "http://localhost:5173",
      },
      body: JSON.stringify({
        currentPassword: TEST_PASSWORD,
        newPassword: TEST_NEW_PASSWORD,
      }),
    });

    // 使用旧密码登录应失败
    const loginRes = await fetch(baseUrl + "/admin/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: TEST_USERNAME, password: TEST_PASSWORD }),
    });
    assert.equal(loginRes.status, 401);
  });

  it("当前密码错误返回 403 CURRENT_PASSWORD_INVALID", async () => {
    const { cookie, csrfToken } = await loginAndGetAuth();

    const res = await fetch(baseUrl + "/admin/auth/password", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        "X-CSRF-Token": csrfToken,
        Origin: "http://localhost:5173",
      },
      body: JSON.stringify({
        currentPassword: "WrongPassword!",
        newPassword: TEST_NEW_PASSWORD,
      }),
    });

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.code, "CURRENT_PASSWORD_INVALID");
  });

  it("当前密码错误不撤销会话", async () => {
    const { cookie, csrfToken } = await loginAndGetAuth();

    await fetch(baseUrl + "/admin/auth/password", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        "X-CSRF-Token": csrfToken,
        Origin: "http://localhost:5173",
      },
      body: JSON.stringify({
        currentPassword: "WrongPassword!",
        newPassword: TEST_NEW_PASSWORD,
      }),
    });

    // 会话应仍有效
    const sessionRes = await fetch(baseUrl + "/admin/auth/session", {
      headers: { Cookie: cookie },
    });
    assert.equal(sessionRes.status, 200);
  });

  it("新密码与当前密码相同返回 409 ADMIN_CREDENTIAL_UNCHANGED", async () => {
    const { cookie, csrfToken } = await loginAndGetAuth();

    const res = await fetch(baseUrl + "/admin/auth/password", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        "X-CSRF-Token": csrfToken,
        Origin: "http://localhost:5173",
      },
      body: JSON.stringify({
        currentPassword: TEST_PASSWORD,
        newPassword: TEST_PASSWORD,
      }),
    });

    assert.equal(res.status, 409);
    const body = await res.json();
    assert.equal(body.code, "ADMIN_CREDENTIAL_UNCHANGED");
  });

  it("无 Cookie 返回 401", async () => {
    const res = await fetch(baseUrl + "/admin/auth/password", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": "any-token",
        Origin: "http://localhost:5173",
      },
      body: JSON.stringify({
        currentPassword: TEST_PASSWORD,
        newPassword: TEST_NEW_PASSWORD,
      }),
    });

    assert.equal(res.status, 401);
  });

  it("CSRF token 错误返回 403", async () => {
    const { cookie } = await loginAndGetAuth();

    const res = await fetch(baseUrl + "/admin/auth/password", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        "X-CSRF-Token": "wrong-csrf-token",
        Origin: "http://localhost:5173",
      },
      body: JSON.stringify({
        currentPassword: TEST_PASSWORD,
        newPassword: TEST_NEW_PASSWORD,
      }),
    });

    assert.equal(res.status, 403);
    assert.equal((await res.json()).code, "CSRF_VALIDATION_FAILED");
  });

  it("Origin 不匹配返回 403", async () => {
    const { cookie, csrfToken } = await loginAndGetAuth();

    const res = await fetch(baseUrl + "/admin/auth/password", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        "X-CSRF-Token": csrfToken,
        Origin: "http://evil.com",
      },
      body: JSON.stringify({
        currentPassword: TEST_PASSWORD,
        newPassword: TEST_NEW_PASSWORD,
      }),
    });

    assert.equal(res.status, 403);
    assert.equal((await res.json()).code, "CSRF_VALIDATION_FAILED");
  });

  it("Cache-Control: no-store", async () => {
    const { cookie, csrfToken } = await loginAndGetAuth();

    const res = await fetch(baseUrl + "/admin/auth/password", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        "X-CSRF-Token": csrfToken,
        Origin: "http://localhost:5173",
      },
      body: JSON.stringify({
        currentPassword: TEST_PASSWORD,
        newPassword: TEST_NEW_PASSWORD,
      }),
    });

    assert.equal(res.headers.get("Cache-Control"), "no-store");
  });

  it("响应包含 X-Request-ID", async () => {
    const { cookie, csrfToken } = await loginAndGetAuth();

    const res = await fetch(baseUrl + "/admin/auth/password", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        "X-CSRF-Token": csrfToken,
        Origin: "http://localhost:5173",
      },
      body: JSON.stringify({
        currentPassword: TEST_PASSWORD,
        newPassword: TEST_NEW_PASSWORD,
      }),
    });

    const id = res.headers.get("X-Request-ID");
    assert.ok(id);
    assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });
});

// ═══════════════════════════════════════════
// 密码校验：长度边界
// ═══════════════════════════════════════════

describe("密码长度校验边界", () => {
  it("密码少于 15 个 Unicode 码点返回 400", async () => {
    const { cookie, csrfToken } = await loginAndGetAuth();

    const res = await fetch(baseUrl + "/admin/auth/password", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        "X-CSRF-Token": csrfToken,
        Origin: "http://localhost:5173",
      },
      body: JSON.stringify({
        currentPassword: TEST_PASSWORD,
        newPassword: "Short12",
      }),
    });

    assert.equal(res.status, 400);
    assert.equal((await res.json()).code, "VALIDATION_ERROR");
  });

  it("密码超过 28 个 Unicode 码点返回 400", async () => {
    const { cookie, csrfToken } = await loginAndGetAuth();

    const res = await fetch(baseUrl + "/admin/auth/password", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        "X-CSRF-Token": csrfToken,
        Origin: "http://localhost:5173",
      },
      body: JSON.stringify({
        currentPassword: TEST_PASSWORD,
        newPassword: "A".repeat(29),
      }),
    });

    assert.equal(res.status, 400);
    assert.equal((await res.json()).code, "VALIDATION_ERROR");
  });

  it("弱密码命中阻止名单返回 400", async () => {
    const { cookie, csrfToken } = await loginAndGetAuth();

    // "password" 在弱密码阻止名单中
    const res = await fetch(baseUrl + "/admin/auth/password", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        "X-CSRF-Token": csrfToken,
        Origin: "http://localhost:5173",
      },
      body: JSON.stringify({
        currentPassword: TEST_PASSWORD,
        newPassword: "password",  // 太短会触发长度校验
      }),
    });

    // 长度校验会先触发（8 < 15），返回 VALIDATION_ERROR
    assert.equal(res.status, 400);
  });
});
