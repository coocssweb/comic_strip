#!/usr/bin/env node
// 管理员初始化 CLI — 仅 TTY 交互式运行，创建唯一管理员
// 凭据不得通过命令行参数、环境变量或管道传入

import { createInterface } from "node:readline";
import { stdin, stdout, exit } from "node:process";
import { v4 as uuidv4 } from "uuid";
import argon2 from "argon2";
import mongoose from "mongoose";
import Admin from "../models/admin.model.js";
import {
  normalizeAndValidateUsername,
  validateNewPassword,
  loadWeakPasswordBlocklist,
} from "../services/password.service.js";
import { count as countAdmins } from "../repositories/admin.repository.js";
import { setupDatabase, disconnectDatabase } from "../db/setup.js";

// ── TTY 守卫 ──
if (!stdin.isTTY) {
  console.error("admin:init 必须在交互式终端中运行");
  exit(1);
}

// ── 加载配置 ──
import { loadConfig } from "../config/index.js";

let config;
try {
  config = loadConfig();
} catch (err) {
  console.error("配置加载失败: " + err.message);
  exit(1);
}

// ── 加载弱密码阻止名单 ──
loadWeakPasswordBlocklist();

const requestId = uuidv4();

/**
 * 交互式询问并返回用户输入
 * @param {import("readline").Interface} rl
 * @param {string} prompt - 提示文本
 * @param {{ hidden?: boolean }} [opts]
 * @returns {Promise<string>}
 */
function ask(rl, prompt, opts = {}) {
  return new Promise((resolve) => {
    if (opts.hidden) {
      // 密码不回显：使用 stdin 原始模式
      const wasRaw = stdin.isRaw;
      stdin.setRawMode(true);
      stdout.write(prompt);
      let input = "";

      const onData = (chunk) => {
        const str = chunk.toString("utf-8");
        for (const ch of str) {
          if (ch === "\r" || ch === "\n") {
            stdout.write("\n");
            stdin.removeListener("data", onData);
            if (!wasRaw) stdin.setRawMode(false);
            resolve(input);
            return;
          }
          if (ch === "\x7f" || ch === "\b") {
            // 退格键
            if (input.length > 0) {
              input = input.slice(0, -1);
              stdout.write("\b \b");
            }
          } else if (ch >= " ") {
            input += ch;
            stdout.write("*");
          }
        }
      };

      stdin.on("data", onData);
    } else {
      rl.question(prompt, (answer) => {
        resolve(answer);
      });
    }
  });
}

async function main() {
  // 1. 连接数据库并确保集合校验就绪
  console.log("正在连接数据库...");
  try {
    await setupDatabase(config.mongodbUri, {
      info: () => {},
      error: (obj) => console.error("数据库启动错误:", obj.error),
    });
  } catch (err) {
    console.error("数据库连接失败: " + err.message);
    exit(1);
  }

  // 2. 检查管理员是否已存在
  const adminCount = await countAdmins();
  if (adminCount > 0) {
    console.error("管理员已存在，不能重复初始化。如需重置凭据，请使用 npm run admin:recover");
    await disconnectDatabase();
    exit(1);
  }

  // 3. 交互式收集凭据
  const rl = createInterface({ input: stdin, output: stdout });

  try {
    // 登录名
    let username;
    while (true) {
      const raw = await ask(rl, "登录名: ");
      try {
        username = normalizeAndValidateUsername(raw);
        break;
      } catch (err) {
        console.error("  " + err.message);
      }
    }

    // 密码（不回显）
    let password;
    while (true) {
      const raw = await ask(rl, "密码: ", { hidden: true });
      try {
        password = validateNewPassword(raw);
        break;
      } catch (err) {
        console.error("  " + err.message);
      }
    }

    // 确认密码
    while (true) {
      const confirm = await ask(rl, "确认密码: ", { hidden: true });
      if (confirm.normalize("NFC") === password) {
        break;
      }
      console.error("  两次密码输入不一致，请重新输入");
      // 重新输入密码
      while (true) {
        const raw = await ask(rl, "密码: ", { hidden: true });
        try {
          password = validateNewPassword(raw);
          break;
        } catch (err) {
          console.error("  " + err.message);
        }
      }
    }

    rl.close();

    // 4. Argon2id 散列
    console.log("正在生成密码散列...");
    const passwordHash = await argon2.hash(password);

    // 5. 插入管理员文档（sessionGeneration = 1 是模型默认值）
    const admin = new Admin({ username, passwordHash });
    await admin.save();

    // 6. 输出成功信息（仅输出规范化的登录名和 requestId）
    console.log("管理员初始化成功");
    console.log("登录名: " + username);
    console.log("requestId: " + requestId);

    exit(0);
  } catch (err) {
    console.error("初始化失败: " + (err.message || "未知错误"));
    exit(1);
  } finally {
    await disconnectDatabase();
  }
}

main();
