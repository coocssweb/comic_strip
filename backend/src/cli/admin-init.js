import { randomUUID } from 'node:crypto';
import readline from 'node:readline';
import { pathToFileURL } from 'node:url';

import { appendAuditEvent } from '../audit/audit-repository.js';
import { loadRuntimeConfig } from '../config/runtime-config.js';
import { createPrimaryAdmin, findPrimaryAdmin } from '../db/admin-repository.js';
import { createCollectionRegistry } from '../db/collection-registry.js';
import { createMongoConnection } from '../db/mongo-connection.js';
import { createJsonLogger } from '../observability/json-logger.js';
import { validatePassword, validateUsername } from '../security/credential-validator.js';
import { hashPassword } from '../security/password-hasher.js';

function promptSecret(rl, query) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    process.stdout.write(query);

    const onData = (char) => {
      char = `${char}`;
      switch (char) {
        case '\n':
        case '\r':
        case '\u0004':
          stdin.removeListener('data', onData);
          break;
        default:
          process.stdout.clearLine(0);
          process.stdout.cursorTo(0);
          process.stdout.write(`${query}${Array(rl.line.length + 1).join('*')}`);
          break;
      }
    };

    stdin.on('data', onData);
    rl.question('', (value) => {
      stdin.removeListener('data', onData);
      process.stdout.write('\n');
      resolve(value);
    });
  });
}

function promptText(rl, query) {
  return new Promise((resolve) => {
    rl.question(query, (value) => resolve(value));
  });
}

/**
 * 运行唯一管理员初始化逻辑。
 *
 * @param {{
 *   env?: NodeJS.ProcessEnv | Record<string, string | undefined>,
 *   stdin?: NodeJS.ReadableStream & {isTTY?: boolean},
 *   stdout?: NodeJS.WritableStream & {isTTY?: boolean},
 *   stderr?: NodeJS.WritableStream,
 *   promptHandler?: (query: string, isSecret?: boolean) => Promise<string>,
 * }} options
 * @returns {Promise<{exitCode: number, requestId: string, username?: string}>}
 */
export async function runAdminInit({
  env = process.env,
  stdin = process.stdin,
  stdout = process.stdout,
  stderr = process.stderr,
  promptHandler,
} = {}) {
  const requestId = randomUUID();
  const logger = createJsonLogger({ stdout, stderr, level: env.LOG_LEVEL });

  if (!stdin.isTTY || !stdout.isTTY) {
    stderr.write('错误：npm run admin:init 只允许在可交互 TTY 终端中运行\n');
    return { exitCode: 1, requestId };
  }

  let connection;
  try {
    const config = loadRuntimeConfig(env);
    connection = await createMongoConnection(config.mongoDbUri);

    const registry = createCollectionRegistry();
    await registry.ensure(connection.db);

    const existingAdmin = await findPrimaryAdmin(connection.db);
    if (existingAdmin) {
      stderr.write(`错误：唯一管理员已存在（登录名：${existingAdmin.username}），不能重复初始化\n`);
      await connection.close();
      return { exitCode: 1, requestId };
    }

    let ask;
    let rl;
    if (promptHandler) {
      ask = promptHandler;
    } else {
      rl = readline.createInterface({ input: stdin, output: stdout });
      ask = (query, isSecret) => isSecret ? promptSecret(rl, query) : promptText(rl, query);
    }

    let username;
    let password;
    let passwordConfirm;
    try {
      const rawUsername = await ask('请输入规范化登录名: ', false);
      username = validateUsername(rawUsername);

      const rawPassword = await ask('请输入管理员密码: ', true);
      password = validatePassword(rawPassword, username);

      const rawConfirm = await ask('请再次确认管理员密码: ', true);
      if (rawPassword !== rawConfirm) {
        throw new Error('两次输入的密码不一致');
      }
    } finally {
      if (rl) {
        rl.close();
      }
    }

    const passwordHash = await hashPassword(password);
    await createPrimaryAdmin(connection.db, { username, passwordHash });

    try {
      await appendAuditEvent(
        connection.db,
        {
          eventType: 'ADMIN_INITIALIZATION',
          outcome: 'succeeded',
          actorType: 'trusted_operator',
          requestId,
          adminId: 'primary-admin',
          username,
        },
        config,
      );
    } catch (auditErr) {
      logger.error('安全审计追加失败', { requestId, errorSummary: auditErr.message });
      stderr.write(`警告：唯一管理员初始化成功，但安全审计日志追加失败（${auditErr.message}）\n`);
    }

    stdout.write(`唯一管理员初始化成功\n规范化登录名: ${username}\n请求标识 (requestId): ${requestId}\n`);
    await connection.close();
    return { exitCode: 0, requestId, username };
  } catch (error) {
    logger.error('管理员初始化失败', { requestId, errorSummary: error.message });
    stderr.write(`错误：管理员初始化失败（${error.message}）\n`);
    if (connection) {
      try {
        await connection.close();
      } catch {
        // Safe fallback
      }
    }
    return { exitCode: 1, requestId };
  }
}

const entryPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === entryPath) {
  const result = await runAdminInit();
  process.exitCode = result.exitCode;
}
