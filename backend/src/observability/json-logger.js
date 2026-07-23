const LOG_LEVEL_WEIGHTS = Object.freeze({
  fatal: 60,
  error: 50,
  warn: 40,
  info: 30,
  debug: 20,
  trace: 10,
});
const ALLOWED_FIELDS = Object.freeze([
  'requestId',
  'method',
  'route',
  'status',
  'durationMs',
  'errorSummary',
]);

function pickAllowedFields(fields) {
  const picked = {};
  for (const fieldName of ALLOWED_FIELDS) {
    if (fields[fieldName] !== undefined) {
      picked[fieldName] = fields[fieldName];
    }
  }
  return picked;
}

/**
 * 日志器只接收固定字段，调用方即使误传请求对象也不会被序列化。
 *
 * @param {{stdout?: NodeJS.WritableStream, stderr?: NodeJS.WritableStream, level?: string}} options
 * @returns {Readonly<{
 *   fatal: (event: string, fields?: object) => void,
 *   error: (event: string, fields?: object) => void,
 *   info: (event: string, fields?: object) => void,
 * }>}
 */
export function createJsonLogger({ stdout = process.stdout, stderr = process.stderr, level = 'info' } = {}) {
  const threshold = LOG_LEVEL_WEIGHTS[level] ?? LOG_LEVEL_WEIGHTS.info;

  function write(logLevel, event, fields = {}) {
    if (LOG_LEVEL_WEIGHTS[logLevel] < threshold) {
      return;
    }

    const record = {
      timestamp: new Date().toISOString(),
      level: logLevel,
      event,
      ...pickAllowedFields(fields),
    };
    const destination = LOG_LEVEL_WEIGHTS[logLevel] >= LOG_LEVEL_WEIGHTS.error ? stderr : stdout;
    destination.write(`${JSON.stringify(record)}\n`);
  }

  return Object.freeze({
    fatal: (event, fields) => write('fatal', event, fields),
    info: (event, fields) => write('info', event, fields),
    error: (event, fields) => write('error', event, fields),
  });
}
