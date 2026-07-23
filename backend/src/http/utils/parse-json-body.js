/**
 * JSON 请求体解析错误。
 * 携带 HTTP 状态码和业务错误码，供调用方直接映射到响应。
 */
export class JsonBodyError extends Error {
  /**
   * @param {number} status HTTP 状态码
   * @param {string} code   业务错误码
   * @param {string} message 中文错误描述
   */
  constructor(status, code, message) {
    super(message);
    this.name = 'JsonBodyError';
    this.status = status;
    this.code = code;
  }
}

/**
 * 从 Node.js 请求流中读取原始字节并拼接为 UTF-8 字符串。
 *
 * @param {import('node:http').IncomingMessage} req
 * @param {number} limit 最大字节数
 * @returns {Promise<string>}
 */
function readRawBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new JsonBodyError(413, 'PAYLOAD_TOO_LARGE', '请求正文超过上限'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', reject);
  });
}

/**
 * 从请求流读取并解析 JSON 正文。
 *
 * 验证 Content-Type 为 application/json、正文不超过限制、
 * 解析结果为非 null 非数组的 object。
 * 字段级校验（白名单、类型）由调用方自行完成。
 *
 * @param {import('node:http').IncomingMessage} req  原始请求流
 * @param {string} contentTypeHeader                 Content-Type 头部值
 * @param {{ limit?: number }} [options]              可选配置
 * @returns {Promise<object>} 解析后的请求体对象
 * @throws {JsonBodyError} 415 / 413 / 400
 */
export async function parseJsonBody(req, contentTypeHeader, { limit = 8192 } = {}) {
  if (!contentTypeHeader || !contentTypeHeader.toLowerCase().startsWith('application/json')) {
    throw new JsonBodyError(415, 'UNSUPPORTED_MEDIA_TYPE', '只接受 application/json 请求');
  }

  const rawBody = await readRawBody(req, limit);

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    throw new JsonBodyError(400, 'VALIDATION_ERROR', '请求参数格式错误');
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new JsonBodyError(400, 'VALIDATION_ERROR', '请求参数格式错误');
  }

  return body;
}
