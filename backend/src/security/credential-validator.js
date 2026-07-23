import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const WEAK_PASSWORDS_JSON_PATH = fileURLToPath(new URL('../resources/weak-passwords-sha256.json', import.meta.url));

let weakPasswordsSet = null;

function loadWeakPasswordsSet() {
  if (weakPasswordsSet) {
    return weakPasswordsSet;
  }
  try {
    const raw = readFileSync(WEAK_PASSWORDS_JSON_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    weakPasswordsSet = new Set(parsed.hashes || []);
  } catch {
    weakPasswordsSet = new Set();
  }
  return weakPasswordsSet;
}

const USERNAME_REGEX = /^[a-z0-9][a-z0-9._-]*[a-z0-9]$/;

/**
 * 校验并规范化登录名：去除首尾空白，转为小写，检查长度及字符规则。
 *
 * @param {string} rawUsername
 * @returns {string} 规范化后的登录名
 */
export function validateUsername(rawUsername) {
  if (typeof rawUsername !== 'string') {
    throw new Error('登录名必须为字符串');
  }
  const username = rawUsername.trim().toLowerCase();
  if (username.length < 3 || username.length > 64) {
    throw new Error('登录名长度必须在 3 到 64 个字符之间');
  }
  if (!USERNAME_REGEX.test(username)) {
    throw new Error('登录名格式不符合要求（只允许小写字母、数字、点、下划线、连字符，且首尾必须为字母或数字）');
  }
  return username;
}

const CONTEXT_BLOCKLIST_TERMS = Object.freeze([
  'comic-strip',
  'apollo.example.com',
  'apis.example.com',
]);

/**
 * 校验密码：执行 NFC 规范化、15~128 Unicode 码点长度校验、本地弱密码库与上下文阻止名单校验。
 *
 * @param {string} rawPassword
 * @param {string} [normalizedUsername]
 * @returns {string} NFC 规范化后的密码
 */
export function validatePassword(rawPassword, normalizedUsername) {
  if (typeof rawPassword !== 'string') {
    throw new Error('密码必须为字符串');
  }
  const normalizedPassword = rawPassword.normalize('NFC');
  const codePointLength = [...normalizedPassword].length;

  if (codePointLength < 15 || codePointLength > 128) {
    throw new Error('密码长度必须在 15 到 128 个字符之间');
  }

  const sha256Hash = createHash('sha256').update(normalizedPassword).digest('hex').toLowerCase();
  const weakSet = loadWeakPasswordsSet();
  if (weakSet.has(sha256Hash)) {
    throw new Error('密码过于简单，属于已知泄露弱密码');
  }

  const lowerPassword = normalizedPassword.toLowerCase();
  if (normalizedUsername && lowerPassword.includes(normalizedUsername.toLowerCase())) {
    throw new Error('密码不能包含用户名或其变体');
  }

  for (const term of CONTEXT_BLOCKLIST_TERMS) {
    if (lowerPassword.includes(term)) {
      throw new Error('密码不能包含项目标识或域名等上下文敏感词');
    }
  }

  return normalizedPassword;
}
