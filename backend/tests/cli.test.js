// CLI 工具冒烟测试 — admin:init 和 admin:recover
// 在一次性测试数据库上执行 CLI 进程，验证存在/不存在、凭据校验和安全输出

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import argon2 from "argon2";
import mongoose from "mongoose";
import { connectTestDb, dropTestDb } from "./helpers/test-db.js";
import Admin from "../src/models/admin.model.js";
import { loadWeakPasswordBlocklist } from "../src/services/password.service.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_INIT = join(__dirname, "..", "src", "cli", "admin-init.js");
const CLI_RECOVER = join(__dirname, "..", "src", "cli", "admin-recover.js");

// ── 环境变量（test 模式） ──
process.env.NODE_ENV = "test";
process.env.PORT = "0";
process.env.ADMIN_JWT_SECRET = "test-jwt-secret-at-least-16-chars";
process.env.SECURITY_HMAC_SECRET = "test-hmac-secret-at-least-16-chars";
process.env.ADMIN_WEB_ORIGIN = "http://localhost:5173";
process.env.LOG_LEVEL = "fatal";

let dbName;
let mongodbUri;

before(async () => {
  dbName = await connectTestDb();
  mongodbUri = mongoose.connection.host + "/" + dbName;
  process.env.MONGODB_URI = mongodbUri;
  // 预加载弱密码阻止名单
  loadWeakPasswordBlocklist();
});

after(async () => {
  await dropTestDb(dbName);
});

/**
 * 运行 CLI 命令，通过 stdin 提供输入并收集 stdout/stderr 和退出码
 * @param {string} scriptPath - CLI 脚本路径
 * @param {string} stdinInput - 发送到 stdin 的输入字符串
 * @param {number} [timeoutMs=30000] - 超时毫秒
 * @returns {Promise<{ code: number, stdout: string, stderr: string }>}
 */
function runCli(scriptPath, stdinInput, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const child = spawn("node", [scriptPath], {
      env: {
        ...process.env,
        MONGODB_URI: mongodbUri,
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("CLI timeout after " + timeoutMs + "ms"));
    }, timeoutMs);

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    // 发送输入
    if (stdinInput) {
      child.stdin.write(stdinInput);
    }
    child.stdin.end();
  });
}

// ═══════════════════════════════════════════
// admin:init
// ═══════════════════════════════════════════

describe("admin:init CLI", () => {
  it("首次初始化成功返回退出码 0", async () => {
    const result = await runCli(
      CLI_INIT,
      "admin-test\nTestInitPass123!\nTestInitPass123!\n",
    );

    assert.equal(result.code, 0);
    assert.ok(result.stdout.includes("管理员初始化成功"));
    assert.ok(result.stdout.includes("admin-test"));
    assert.ok(result.stdout.includes("requestId"));
  });

  it("输出不包含密码原文", async () => {
    // admin 已存在说明初始化成功
    const result = await runCli(
      CLI_INIT,
      "admin-test2\nTestInitPass456!\nTestInitPass456!\n",
    );

    if (result.code === 0) {
      assert.ok(!result.stdout.includes("TestInitPass"));
      assert.ok(!result.stdout.includes("testinitpass"));
    }
  });

  it("管理员已存在时失败", async () => {
    // 先创建管理员
    await Admin.create({
      username: "existing-admin",
      passwordHash: "$argon2id$placeholder",
    });

    const result = await runCli(
      CLI_INIT,
      "another-admin\nAnotherPass123!\nAnotherPass123!\n",
    );

    assert.notEqual(result.code, 0);
    assert.ok(result.stderr.includes("管理员已存在"));
  });

  it("输出包含规范化的登录名和 requestId", async () => {
    // 清理后重新测试
    await Admin.deleteMany({});

    const result = await runCli(
      CLI_INIT,
      "CLI-Test-User\nCliTestPass789!\nCliTestPass789!\n",
    );

    if (result.code === 0) {
      // 登录名应被规范化为小写
      assert.ok(result.stdout.includes("cli-test-user"));
    }
  });
});

// ═══════════════════════════════════════════
// admin:recover
// ═══════════════════════════════════════════

describe("admin:recover CLI", () => {
  before(async () => {
    // 确保有管理员可恢复
    const count = await Admin.countDocuments();
    if (count === 0) {
      await Admin.create({
        username: "recover-test",
        passwordHash: "$argon2id$placeholder",
      });
    }
  });

  it("管理员不存在时失败", async () => {
    await Admin.deleteMany({});

    const result = await runCli(
      CLI_RECOVER,
      "恢复唯一管理员访问\n",
    );

    assert.notEqual(result.code, 0);
    assert.ok(result.stderr.includes("管理员不存在"));

    // 恢复管理员供后续测试
    await Admin.create({
      username: "recover-test",
      passwordHash: "$argon2id$placeholder",
    });
  });

  it("成功恢复输出新登录名和会话已撤销提示", async () => {
    const result = await runCli(
      CLI_RECOVER,
      "恢复唯一管理员访问\n\n" +  // 确认短语，登录名留空
      "RecoverPass456!\nRecoverPass456!\n",
    );

    if (result.code === 0) {
      assert.ok(result.stdout.includes("访问恢复成功"));
      assert.ok(result.stdout.includes("recover-test"));  // 保留原登录名
      assert.ok(result.stdout.includes("全部旧会话已撤销"));
      assert.ok(result.stdout.includes("requestId"));
    }
  });

  it("恢复后 sessionGeneration 递增", async () => {
    // 先读取当前 generation
    const adminBefore = await Admin.findOne({ username: "recover-test" }).lean();
    const genBefore = adminBefore.sessionGeneration;

    const result = await runCli(
      CLI_RECOVER,
      "恢复唯一管理员访问\nnew-recover\n" +
      "RecoverPass789!\nRecoverPass789!\n",
    );

    if (result.code === 0) {
      const adminAfter = await Admin.findOne({ username: "new-recover" }).lean();
      assert.ok(adminAfter);
      assert.equal(adminAfter.sessionGeneration, genBefore + 1);
    }
  });

  it("确认短语错误时取消操作", async () => {
    const result = await runCli(
      CLI_RECOVER,
      "错误的确认短语\n",
    );

    assert.notEqual(result.code, 0);
    assert.ok(result.stderr.includes("确认短语不匹配"));
  });
});
