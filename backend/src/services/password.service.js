// 密码校验服务 — NFC 规范化、长度校验、弱密码阻止名单检查
// 纯函数，不依赖 HTTP 上下文，可被 API 和 CLI 共用

import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { AppError } from "../middlewares/error-handler.middleware.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── 密码长度限制 ──
/** 密码最小 Unicode 码点数 */
const MIN_CODEPOINTS = 15;
/** 密码最大 Unicode 码点数 */
const MAX_CODEPOINTS = 28;

// ── 弱密码阻止名单 ──
/** 弱密码 SHA-256 哈希集合 */
let _weakPasswordHashes = null;
/** 阻止名单是否已加载 */
let _blocklistLoaded = false;

/**
 * 加载弱密码阻止名单。
 * 文件格式：前 N 行为注释元数据（以 # 开头），之后每行一个 SHA-256 十六进制哈希。
 * 元数据必须包含 source、version、integrity 字段。
 * 仅在首次调用时加载，后续调用复用缓存。
 *
 * @param {string} [filePath] - 阻止名单文件路径，默认使用内置列表
 */
export function loadWeakPasswordBlocklist(filePath) {
  if (_blocklistLoaded) return;

  const defaultPath = join(__dirname, "..", "data", "weak-passwords.sha256");
  const resolvedPath = filePath || defaultPath;

  if (!existsSync(resolvedPath)) {
    console.error(`弱密码阻止名单文件不存在: ${resolvedPath}`);
    _weakPasswordHashes = new Set();
    _blocklistLoaded = true;
    return;
  }

  const content = readFileSync(resolvedPath, "utf-8");
  const lines = content.split(/\r?\n/);
  const hashes = new Set();
  let metadataEnded = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (!metadataEnded && trimmed.startsWith("#")) {
      // 元数据行：已在上方注释，解析交给调用方或忽略
      continue;
    }
    metadataEnded = true;
    // 每行应为 64 字符的十六进制 SHA-256 哈希
    if (/^[0-9a-f]{64}$/i.test(trimmed)) {
      hashes.add(trimmed.toLowerCase());
    }
  }

  _weakPasswordHashes = hashes;
  _blocklistLoaded = true;
}

/**
 * NFC 规范化密码字符串。
 * @param {string} password - 原始密码
 * @returns {string} NFC 规范化后的密码
 */
export function normalizePassword(password) {
  return password.normalize("NFC");
}

/**
 * 校验密码 Unicode 码点长度。
 * @param {string} password - 已规范化的密码
 * @throws {AppError} 长度不符合要求时抛出 400 VALIDATION_ERROR
 */
export function validatePasswordLength(password) {
  const count = [...password].length;
  if (count < MIN_CODEPOINTS || count > MAX_CODEPOINTS) {
    throw new AppError(
      `密码长度必须为 ${MIN_CODEPOINTS}-${MAX_CODEPOINTS} 个字符`,
      400,
      "VALIDATION_ERROR",
    );
  }
}

/**
 * 弱密码阻止名单检查。
 * 对 NFC 规范化后的完整密码计算 SHA-256，查询阻止名单。
 *
 * @param {string} normalizedPassword - NFC 规范化后的密码
 * @throws {AppError} 命中阻止名单时抛出 400 VALIDATION_ERROR
 */
export function checkWeakPassword(normalizedPassword) {
  if (!_blocklistLoaded) {
    loadWeakPasswordBlocklist();
  }

  if (_weakPasswordHashes.size === 0) return;

  const hash = createHash("sha256")
    .update(normalizedPassword)
    .digest("hex")
    .toLowerCase();

  if (_weakPasswordHashes.has(hash)) {
    throw new AppError("密码过于常见，请使用更强的密码", 400, "VALIDATION_ERROR");
  }
}

/**
 * 对密码执行完整校验流水线：
 * NFC 规范化 → 长度校验 → 弱密码阻止名单检查
 *
 * @param {string} password - 原始密码
 * @returns {string} NFC 规范化后的密码
 * @throws {AppError} 校验失败时抛出
 */
export function validateNewPassword(password) {
  const normalized = normalizePassword(password);
  validatePasswordLength(normalized);
  checkWeakPassword(normalized);
  return normalized;
}

/**
 * 校验登录名规则：
 * 长度 3-40 字符，只允许小写英文字母、数字、点、下划线和连字符，
 * 必须以字母或数字开头和结尾。
 * 输入先去除首尾空白，统一转为小写。
 *
 * @param {string} raw - 原始输入
 * @returns {string} 规范化后的登录名
 * @throws {AppError} 规则不匹配时抛出 400 VALIDATION_ERROR
 */
export function normalizeAndValidateUsername(raw) {
  const trimmed = (raw || "").trim();
  if (!trimmed) {
    throw new AppError("登录名不能为空", 400, "VALIDATION_ERROR");
  }

  const normalized = trimmed.toLowerCase();

  if (normalized.length < 3 || normalized.length > 40) {
    throw new AppError("登录名长度必须为 3-40 个字符", 400, "VALIDATION_ERROR");
  }

  // 只允许小写字母、数字、点、下划线、连字符
  if (!/^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/.test(normalized)) {
    throw new AppError(
      "登录名只能包含小写字母、数字、点、下划线和连字符，且以字母或数字开头和结尾",
      400,
      "VALIDATION_ERROR",
    );
  }

  return normalized;
}

/**
 * 检查两个密码是否相同（NFC 规范化后比较）。
 * @param {string} normalizedNew - 已规范化的新密码
 * @param {string} currentPassword - 当前密码的明文
 * @returns {boolean}
 */
export function isPasswordUnchanged(normalizedNew, currentPassword) {
  return normalizedNew === normalizePassword(currentPassword);
}
