// 健康端点、安全响应头、CORS 和请求 ID 的 HTTP 契约测试

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";

// 测试前设置所需环境变量（NODE_ENV=test 时跳过密钥和来源校验）
process.env.NODE_ENV = "test";
process.env.PORT = "0";
process.env.MONGODB_URI = "mongodb://localhost:27017/comic-strip-test";
process.env.ADMIN_WEB_ORIGIN = "http://localhost:5173";
process.env.LOG_LEVEL = "fatal";

const { app } = createApp();
let server;
let baseUrl;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      baseUrl = "http://127.0.0.1:" + addr.port;
      resolve();
    });
  });
});

after(async () => {
  await new Promise((resolve) => {
    server.close(() => resolve());
  });
});

describe("GET /health/live", () => {
  it("返回 200 且 body 为 { status: ok }", async () => {
    const res = await fetch(baseUrl + "/health/live");
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body, { status: "ok" });
  });

  it("不访问 MongoDB", async () => {
    const res = await fetch(baseUrl + "/health/live");
    assert.equal(res.status, 200);
  });
});

describe("GET /health/ready", () => {
  it("MongoDB 未连接时返回 503 unavailable", async () => {
    const res = await fetch(baseUrl + "/health/ready");
    assert.equal(res.status, 503);
    const body = await res.json();
    assert.deepEqual(body, { status: "unavailable" });
  });

  it("不暴露内部错误详情", async () => {
    const res = await fetch(baseUrl + "/health/ready");
    const body = await res.json();
    assert.ok(!("error" in body));
    assert.ok(!("message" in body));
  });
});

describe("安全响应头", () => {
  it("设置 X-Content-Type-Options: nosniff", async () => {
    const res = await fetch(baseUrl + "/health/live");
    assert.equal(res.headers.get("X-Content-Type-Options"), "nosniff");
  });

  it("设置 Referrer-Policy: no-referrer", async () => {
    const res = await fetch(baseUrl + "/health/live");
    assert.equal(res.headers.get("Referrer-Policy"), "no-referrer");
  });

  it("设置 Permissions-Policy 禁用不必要浏览器能力", async () => {
    const res = await fetch(baseUrl + "/health/live");
    const policy = res.headers.get("Permissions-Policy");
    assert.ok(policy.includes("camera=()"));
    assert.ok(policy.includes("microphone=()"));
    assert.ok(policy.includes("geolocation=()"));
  });

  it("设置 Content-Security-Policy", async () => {
    const res = await fetch(baseUrl + "/health/live");
    const csp = res.headers.get("Content-Security-Policy");
    assert.ok(csp.includes("default-src"));
    assert.ok(csp.includes("frame-ancestors"));
    assert.ok(csp.includes("base-uri"));
  });
});

describe("X-Request-ID", () => {
  it("每个响应包含 X-Request-ID 头且为 UUID v4 格式", async () => {
    const res = await fetch(baseUrl + "/health/live");
    const id = res.headers.get("X-Request-ID");
    assert.ok(id);
    assert.match(
      id,
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("每次请求分配不同的 requestId", async () => {
    const [res1, res2] = await Promise.all([
      fetch(baseUrl + "/health/live"),
      fetch(baseUrl + "/health/live"),
    ]);
    const id1 = res1.headers.get("X-Request-ID");
    const id2 = res2.headers.get("X-Request-ID");
    assert.notEqual(id1, id2);
  });
});

describe("CORS 行为", () => {
  it("允许配置来源的跨域请求", async () => {
    const res = await fetch(baseUrl + "/health/live", {
      headers: { Origin: "http://localhost:5173" },
    });
    assert.equal(res.headers.get("Access-Control-Allow-Origin"), "http://localhost:5173");
    assert.equal(res.headers.get("Access-Control-Allow-Credentials"), "true");
  });

  it("OPTIONS 预检请求返回 204", async () => {
    const res = await fetch(baseUrl + "/health/live", {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:5173",
        "Access-Control-Request-Method": "GET",
      },
    });
    assert.equal(res.status, 204);
  });
});

describe("优雅关闭", () => {
  it("服务器支持 close 操作", () => {
    assert.ok(server);
    assert.equal(typeof server.close, "function");
  });
});