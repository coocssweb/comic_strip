// COS 配置校验测试 — 验证非 test 环境 COS 必填校验

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../src/config/index.js";

// 每个测试前重置 NODE_ENV 和 COS 相关变量，确保隔离
function resetCosEnv() {
  delete process.env.COS_SECRET_ID;
  delete process.env.COS_SECRET_KEY;
  delete process.env.COS_BUCKET;
  delete process.env.COS_REGION;
  delete process.env.COS_CDN_DOMAIN;
}

describe("COS 配置校验", () => {
  it("test 环境缺失 COS 配置时正常启动", () => {
    resetCosEnv();
    process.env.NODE_ENV = "test";
    process.env.PORT = "0";
    process.env.MONGODB_URI = "mongodb://localhost:27017/test";
    process.env.LOG_LEVEL = "fatal";
    // 覆盖 process.exit 防止测试中退出进程
    const originalExit = process.exit;
    process.exit = (code) => {
      throw new Error("process.exit called with " + code);
    };

    try {
      const config = loadConfig();
      assert.equal(config.nodeEnv, "test");
      // COS 配置字段存在但为空字符串
      assert.equal(config.cos.secretId, "");
      assert.equal(config.cos.secretKey, "");
      assert.equal(config.cos.bucket, "");
      assert.equal(config.cos.region, "");
      assert.equal(config.cos.cdnDomain, "");
    } finally {
      process.exit = originalExit;
    }
  });

  it("test 环境有 COS 配置时正常启动并返回配置值", () => {
    resetCosEnv();
    process.env.NODE_ENV = "test";
    process.env.PORT = "0";
    process.env.MONGODB_URI = "mongodb://localhost:27017/test";
    process.env.LOG_LEVEL = "fatal";
    process.env.COS_SECRET_ID = "test-secret-id";
    process.env.COS_SECRET_KEY = "test-secret-key";
    process.env.COS_BUCKET = "test-bucket";
    process.env.COS_REGION = "ap-guangzhou";
    process.env.COS_CDN_DOMAIN = "https://cdn.test.com";

    const originalExit = process.exit;
    process.exit = (code) => {
      throw new Error("process.exit called with " + code);
    };

    try {
      const config = loadConfig();
      assert.equal(config.cos.secretId, "test-secret-id");
      assert.equal(config.cos.secretKey, "test-secret-key");
      assert.equal(config.cos.bucket, "test-bucket");
      assert.equal(config.cos.region, "ap-guangzhou");
      assert.equal(config.cos.cdnDomain, "https://cdn.test.com");
    } finally {
      process.exit = originalExit;
    }
  });

  it("非 test 环境缺失 COS_SECRET_ID 时拒绝启动", () => {
    resetCosEnv();
    process.env.NODE_ENV = "development";
    process.env.PORT = "4001";
    process.env.MONGODB_URI = "mongodb://localhost:27017/comic-strip";
    process.env.ADMIN_JWT_SECRET = "dev-jwt-secret-at-least-16-chars-ok";
    process.env.SECURITY_HMAC_SECRET = "dev-hmac-secret-at-least-16-char";
    process.env.ADMIN_WEB_ORIGIN = "http://localhost:4000";
    process.env.LOG_LEVEL = "info";
    // 故意不设置 COS_SECRET_ID，设置其他 COS 字段
    process.env.COS_SECRET_KEY = "test-key";
    process.env.COS_BUCKET = "test-bucket";
    process.env.COS_REGION = "ap-guangzhou";

    const originalExit = process.exit;
    let exitCode = null;
    process.exit = (code) => {
      exitCode = code;
    };

    try {
      loadConfig();
      // 如果没调用 process.exit(1)，测试应失败
      assert.ok(exitCode !== null, "应该调用 process.exit");
      assert.notEqual(exitCode, 0);
    } finally {
      process.exit = originalExit;
    }
  });

  it("非 test 环境所有 COS 配置齐全时正常启动", () => {
    resetCosEnv();
    process.env.NODE_ENV = "production";
    process.env.PORT = "4001";
    process.env.MONGODB_URI = "mongodb://localhost:27017/comic-strip";
    process.env.ADMIN_JWT_SECRET = "prod-jwt-secret-at-least-16-chars";
    process.env.SECURITY_HMAC_SECRET = "prod-hmac-secret-at-least-16-char";
    process.env.ADMIN_WEB_ORIGIN = "https://admin.example.com";
    process.env.LOG_LEVEL = "info";
    process.env.COS_SECRET_ID = "prod-secret-id";
    process.env.COS_SECRET_KEY = "prod-secret-key";
    process.env.COS_BUCKET = "prod-bucket";
    process.env.COS_REGION = "ap-shanghai";

    const originalExit = process.exit;
    process.exit = (code) => {
      throw new Error("process.exit called with " + code);
    };

    try {
      const config = loadConfig();
      assert.equal(config.cos.secretId, "prod-secret-id");
      assert.equal(config.cos.region, "ap-shanghai");
      assert.equal(config.cos.cdnDomain, "");
    } finally {
      process.exit = originalExit;
    }
  });

  it("非 test 环境缺失 COS_BUCKET 时拒绝启动", () => {
    resetCosEnv();
    process.env.NODE_ENV = "development";
    process.env.PORT = "4001";
    process.env.MONGODB_URI = "mongodb://localhost:27017/comic-strip";
    process.env.ADMIN_JWT_SECRET = "dev-jwt-secret-at-least-16-chars-ok";
    process.env.SECURITY_HMAC_SECRET = "dev-hmac-secret-at-least-16-char";
    process.env.ADMIN_WEB_ORIGIN = "http://localhost:4000";
    process.env.LOG_LEVEL = "info";
    process.env.COS_SECRET_ID = "test-id";
    process.env.COS_SECRET_KEY = "test-key";
    process.env.COS_REGION = "ap-guangzhou";
    // 故意不设置 COS_BUCKET

    const originalExit = process.exit;
    let exitCode = null;
    process.exit = (code) => {
      exitCode = code;
    };

    try {
      loadConfig();
      assert.ok(exitCode !== null, "应该调用 process.exit");
      assert.notEqual(exitCode, 0);
    } finally {
      process.exit = originalExit;
    }
  });
});
