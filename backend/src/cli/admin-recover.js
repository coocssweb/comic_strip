import { randomUUID } from 'node:crypto';
import readline from 'node:readline';
import { pathToFileURL } from 'node:url';

import { appendAuditEvent } from '../audit/audit-repository.js';
import { loadRuntimeConfig } from '../config/runtime-config.js';
import { findPrimaryAdmin, updatePrimaryAdminPassword } from '../db/admin-repository.js';
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
 * 运行唯一管理员访问恢复逻辑。
 *
 * @param {{
 *   env?: NodeJS.ProcessEnv | Record<string, string | undefined>,
 *   stdin?: NodeJS.ReadableStream & {isTTY?: boolean},
 *   stdout?: NodeJS.WritableStream & {isTTY?: boolean},
 *   stderr?: NodeJS.WritableStream,
 *   promptHandler?: (query: string, isSecret?: boolean) => Promise<string>,
 * }} options
 * @returns {Promise<{exitCode: number, requestId: string, username?: string, cancelled?: boolean}>}
 */
export async function runAdminRecover({
  env = process.env,
  stdin = process.stdin,
  stdout = process.stdout,
  stderr = process.stderr,
  promptHandler,
} = {}) {
  const requestId = randomUUID();
  const logger = createJsonLogger({ stdout, stderr, level: env.LOG_LEVEL });

  if (!stdin.isTTY || !stdout.isTTY) {
    stderr.write('错误：npm run admin:recover 只允许在可交互 TTY 终端中运行\n');
    return { exitCode: 1, requestId };
  }

  let connection;
  try {
    const config = loadRuntimeConfig(env);
    connection = await createMongoConnection(config.mongoDbUri);

    const registry = createCollectionRegistry();
    await registry.ensure(connection.db);

    const existingAdmin = await findPrimaryAdmin(connection.db);
    if (!existingAdmin) {
      stderr.write('错误：唯一管理员尚未初始化，请先运行 admin:init\n');
      await appendAuditEvent(
        connection.db,
        {
          eventType: 'ADMIN_ACCESS_RECOVERY',
          outcome: 'failed',
          actorType: 'trusted_operator',
          requestId,
          reasonCode: 'ADMIN_NOT_INITIALIZED',
        },
        config,
      ).catch((auditErr) => {
        logger.error('安全审计追加失败', { requestId, errorSummary: auditErr.message });
      });
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

    let targetUsername = existingAdmin.username;
    let newPassword;

    try {
      const rawUsername = await ask(`新登录名（留空保持当前登录名 "${existingAdmin.username}" 不变）: `, false);
      if (rawUsername.trim().length > 0) {
        targetUsername = validateUsername(rawUsername);
      }

      const rawPassword = await ask('请输入新管理员密码: ', true);
      newPassword = validatePassword(rawPassword, targetUsername);

      const rawConfirm = await ask('请再次确认新管理员密码: ', true);
      if (rawPassword !== rawConfirm) {
        throw new Error('两次输入的密码不一致');
      }

      const confirmText = await ask('此操作将覆盖现有管理员凭据并即时撤销所有已有管理会话！确认继续？(输入 RECOVER 以确认): ', false);
      if (confirmText.trim() !== 'RECOVER') {
        stdout.write('操作已取消\n');
        await connection.close();
        return { exitCode: 0, requestId, cancelled: true };
      }
    } finally {
      if (rl) {
        rl.close();
      }
    }

    const newPasswordHash = await hashPassword(newPassword);
    const now = new Date();
    const updateResult = await updatePrimaryAdminPassword(connection.db, {
      expectedGeneration: existingAdmin.sessionGeneration,
      newPasswordHash,
      newUsername: targetUsername,
      now,
    });

    if (!updateResult.updated) {
      stderr.write('错误：管理员凭据已被并发修改，恢复失败\n');
      await appendAuditEvent(
        connection.db,
        {
          eventType: 'ADMIN_ACCESS_RECOVERY',
          outcome: 'failed',
          actorType: 'trusted_operator',
          requestId,
          adminId: 'primary-admin',
          reasonCode: 'ADMIN_CREDENTIAL_CONFLICT',
          sessionGeneration: existingAdmin.sessionGeneration,
        },
        config,
      ).catch((auditErr) => {
        logger.error('安全审计追加失败', { requestId, errorSummary: auditErr.message });
      });
      await connection.close();
      return { exitCode: 1, requestId };
    }

    try {
      await appendAuditEvent(
        connection.db,
        {
          eventType: 'ADMIN_ACCESS_RECOVERY',
          outcome: 'succeeded',
          actorType: 'trusted_operator',
          requestId,
          adminId: 'primary-admin',
          username: targetUsername,
          sessionGeneration: updateResult.newGeneration,
        },
        config,
      );

      await appendAuditEvent(
        connection.db,
        {
          eventType: 'ADMIN_SESSION_REVOCATION',
          outcome: 'succeeded',
          actorType: 'trusted_operator',
          requestId,
          adminId: 'primary-admin',
          revocationScope: 'all',
          sessionGeneration: updateResult.newGeneration,
        },
        config,
      );
    } catch (auditErr) {
      logger.error('安全审计追加失败', { requestId, errorSummary: auditErr.message });
      stderr.write(`警告：管理员访问恢复成功，但安全审计日志追加失败（${auditErr.message}）\n`);
    }

    stdout.write(`管理员访问已成功恢复\n规范化登录名: ${targetUsername}\n所有已有管理会话已被即时撤销\n请求标识 (requestId): ${requestId}\n`);
    await connection.close();
    return { exitCode: 0, requestId, username: targetUsername };
  } catch (error) {
    logger.error('管理员访问恢复失败', { requestId, errorSummary: error.message });
    stderr.write(`错误：管理员访问恢复失败（${error.message}）\n`);
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
  const result = await runAdminRecover();
  process.exitCode = result.exitCode;
}
