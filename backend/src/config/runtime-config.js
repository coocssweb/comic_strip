const ALLOWED_ENVIRONMENTS = new Set(['development', 'test', 'production']);
const ALLOWED_LOG_LEVELS = new Set(['fatal', 'error', 'warn', 'info', 'debug', 'trace']);
const ORIGINS_BY_ENVIRONMENT = Object.freeze({
  development: 'http://localhost:4000',
  test: 'http://localhost:4000',
  production: 'https://apollo.example.com',
});
const MINIMUM_SECRET_BYTES = 32;

function requireEnvironment(value) {
  if (!ALLOWED_ENVIRONMENTS.has(value)) {
    throw new Error('运行配置无效：运行环境不受支持');
  }
  return value;
}

function parsePort(value, nodeEnv) {
  if (value === undefined || value === '') {
    if (nodeEnv === 'development') {
      return 40001;
    }
    throw new Error('运行配置无效：端口不能为空');
  }

  if (!/^\d+$/.test(value)) {
    throw new Error('运行配置无效：端口格式错误');
  }

  const port = Number(value);
  if (!Number.isSafeInteger(port) || port > 65535 || (port === 0 && nodeEnv !== 'test')) {
    throw new Error('运行配置无效：端口超出允许范围');
  }
  return port;
}

function parseMongoDbUri(value) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('运行配置无效：数据库连接配置不能为空');
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('运行配置无效：数据库连接配置格式错误');
  }

  let databaseName;
  try {
    databaseName = decodeURIComponent(parsed.pathname.slice(1));
  } catch {
    throw new Error('运行配置无效：数据库连接配置格式错误');
  }
  const hasValidProtocol = parsed.protocol === 'mongodb:' || parsed.protocol === 'mongodb+srv:';
  const hasSingleDatabaseName = databaseName.length > 0 && !databaseName.includes('/');
  if (!hasValidProtocol || !parsed.hostname || !hasSingleDatabaseName) {
    throw new Error('运行配置无效：数据库连接配置必须包含数据库名');
  }
  return value;
}

function decodeSecret(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`运行配置无效：${label}必须使用 Base64 或 Base64URL 编码`);
  }

  const hasStandardAlphabet = /[+/]/.test(value);
  const hasUrlAlphabet = /[-_]/.test(value);
  const alphabetPattern = hasUrlAlphabet ? /^[A-Za-z0-9_-]+={0,2}$/ : /^[A-Za-z0-9+/]+={0,2}$/;
  const unpaddedValue = value.replace(/=+$/, '');
  const hasValidPadding = !value.includes('=') || value.length % 4 === 0;
  if (hasStandardAlphabet && hasUrlAlphabet
    || !alphabetPattern.test(value)
    || unpaddedValue.length % 4 === 1
    || !hasValidPadding) {
    throw new Error(`运行配置无效：${label}必须使用 Base64 或 Base64URL 编码`);
  }

  const encoding = hasUrlAlphabet ? 'base64url' : 'base64';
  const secret = Buffer.from(unpaddedValue, encoding);
  const canonicalValue = encoding === 'base64url'
    ? secret.toString('base64url')
    : secret.toString('base64').replace(/=+$/, '');
  if (canonicalValue !== unpaddedValue) {
    throw new Error(`运行配置无效：${label}必须使用 Base64 或 Base64URL 编码`);
  }

  if (secret.length < MINIMUM_SECRET_BYTES) {
    throw new Error(`运行配置无效：${label}解码后不能少于 32 字节`);
  }
  if (hasObviousRepeatedPattern(secret)) {
    throw new Error(`运行配置无效：${label}强度不足，不能使用明显重复模式`);
  }
  return secret;
}

function hasObviousRepeatedPattern(secret) {
  const maximumPatternLength = Math.min(16, Math.floor(secret.length / 2));
  for (let patternLength = 1; patternLength <= maximumPatternLength; patternLength += 1) {
    if (secret.length % patternLength !== 0) {
      continue;
    }
    const repeats = secret.every((byte, index) => byte === secret[index % patternLength]);
    if (repeats) {
      return true;
    }
  }
  return false;
}

function requireOrigin(value, nodeEnv) {
  if (value !== ORIGINS_BY_ENVIRONMENT[nodeEnv]) {
    throw new Error('运行配置无效：管理端来源与运行环境不匹配');
  }
  return value;
}

function parseLogLevel(value) {
  const logLevel = value ?? 'info';
  if (!ALLOWED_LOG_LEVELS.has(logLevel)) {
    throw new Error('运行配置无效：日志级别不受支持');
  }
  return logLevel;
}

/**
 * 只从运行环境读取已冻结契约中的白名单键，避免无关进程变量进入应用配置。
 *
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} env
 * @returns {Readonly<{
 *   nodeEnv: 'development' | 'test' | 'production',
 *   port: number,
 *   mongoDbUri: string,
 *   adminJwtSecret: Buffer,
 *   securityHmacSecret: Buffer,
 *   adminWebOrigin: string,
 *   logLevel: string,
 * }>}
 */
export function loadRuntimeConfig(env = process.env) {
  const nodeEnv = requireEnvironment(env.NODE_ENV);
  const adminJwtSecret = decodeSecret(env.ADMIN_JWT_SECRET, 'JWT 安全秘密');
  const securityHmacSecret = decodeSecret(env.SECURITY_HMAC_SECRET, 'HMAC 安全秘密');

  if (adminJwtSecret.equals(securityHmacSecret)) {
    throw new Error('运行配置无效：两个安全秘密不能相同');
  }

  return Object.freeze({
    nodeEnv,
    port: parsePort(env.PORT, nodeEnv),
    mongoDbUri: parseMongoDbUri(env.MONGODB_URI),
    adminJwtSecret,
    securityHmacSecret,
    adminWebOrigin: requireOrigin(env.ADMIN_WEB_ORIGIN, nodeEnv),
    logLevel: parseLogLevel(env.LOG_LEVEL),
  });
}
