#!/usr/bin/env node
// 管理员访问恢复 CLI — 仅 TTY 交互式运行，重置唯一管理员的凭据
// 成功后递增 sessionGeneration 使全部旧会话立即失效

import { createInterface } from "node:readline";
import { stdin, stdout, exit } from "node:process";
import { v4 as uuidv4 } from "node:uuid";
import argon2 from "argon2";
import mongoose from "mongoose";
import {
  normalizeAndValidateUsername,
  validateNewPassword,
  loadWeakPasswordBlocklist,
} from "../services/password.service.js";
import {
  findFirst,
  count as countAdmins,
} from "../repositories/admin.repository.js";
import { removeAllByAdminId } from "../repositories/session.repository.js";
import { setupDatabase, disconnectDatabase } from "../db/setup.js";

// ── TTY 守卫 ──
if (!stdin.isTTY) {
  console.error("admin:recover 必须在交互式终端中运行");
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
 */
function ask(rl, prompt, opts = {}) {
  return new Promise((resolve) => {
    if (opts.hidden) {
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
  // 1. 连接数据库
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

  // 2. 检查管理员存在性
  const adminCount = await countAdmins();
  if (adminCount === 0) {
    console.error("管理员不存在，请先使用 npm run admin:init 初始化");
    await disconnectDatabase();
    exit(1);
  }

  // 3. 读取当前管理员信息
  const admin = await findFirst();
  if (!admin) {
    console.error("无法读取管理员信息");
    await disconnectDatabase();
    exit(1);
  }

  const currentUsername = admin.username;
  const currentGeneration = admin.sessionGeneration;

  const rl = createInterface({ input: stdin, output: stdout });

  try {
    // 4. 显示当前管理员信息并要求确认
    console.log("当前管理员登录名: " + currentUsername);
    console.log("");

    const CONFIRM_PHRASE = "恢复唯一管理员访问";
    const confirmation = await ask(
      rl,
      '请输入确认短语 "' + CONFIRM_PHRASE + '" 以继续: ',
    );

    if (confirmation.trim() !== CONFIRM_PHRASE) {
      console.error("确认短语不匹配，操作已取消");
      rl.close();
      await disconnectDatabase();
      exit(1);
    }

    console.log("");

    // 5. 询问新登录名（留空保持当前）
    let newUsername;
    while (true) {
      const raw = await ask(rl, "新登录名（留空保持 \"" + currentUsername + "\"）: ");
      if (raw.trim() === "") {
        newUsername = currentUsername;
        break;
      }
      try {
        newUsername = normalizeAndValidateUsername(raw);
        break;
      } catch (err) {
        console.error("  " + err.message);
      }
    }

    // 6. 询问新密码
    let newPassword;
    while (true) {
      const raw = await ask(rl, "新密码: ", { hidden: true });
      try {
        newPassword = validateNewPassword(raw);
        break;
      } catch (err) {
        console.error("  " + err.message);
      }
    }

    // 确认新密码
    while (true) {
      const confirm = await ask(rl, "确认新密码: ", { hidden: true });
      if (confirm.normalize("NFC") === newPassword) {
        break;
      }
      console.error("  两次密码输入不一致，请重新输入");
      while (true) {
        const raw = await ask(rl, "新密码: ", { hidden: true });
        try {
          newPassword = validateNewPassword(raw);
          break;
        } catch (err) {
          console.error("  " + err.message);
        }
      }
    }

    rl.close();

    // 7. Argon2id 散列
    console.log("正在生成密码散列...");
    const passwordHash = await argon2.hash(newPassword);

    // 8. CAS 原子更新：以读取到的 sessionGeneration 为前值
    // 同时更新 username（如变更）、passwordHash 和递增 sessionGeneration
    const AdminModel = mongoose.model("Admin");
    const setFields = { passwordHash };
    if (newUsername !== currentUsername) {
      setFields.username = newUsername;
    }
    const result = await AdminModel.findOneAndUpdate(
      {
        _id: admin._id,
        sessionGeneration: currentGeneration,
      },
      {
        $set: setFields,
        $inc: { sessionGeneration: 1 },
      },
      { new: true, lean: true },
    );

    if (!result) {
      console.error("管理员凭据已被并发修改，请重新执行恢复操作");
      rl.close();
      await disconnectDatabase();
      exit(1);
    }

    // 9. 撤销全部会话
    await removeAllByAdminId(admin._id);

    // 10. 输出成功信息
    console.log("访问恢复成功");
    console.log("新登录名: " + newUsername);
    console.log("全部旧会话已撤销，请使用新凭据重新登录");
    console.log("requestId: " + requestId);

    exit(0);
  } catch (err) {
    console.error("恢复失败: " + (err.message || "未知错误"));
    exit(1);
  } finally {
    await disconnectDatabase();
  }
}

main();
