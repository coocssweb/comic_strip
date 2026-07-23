import { appendAuditEvent } from './audit-repository.js';

/**
 * 创建 fire-and-forget 审计追加函数。
 *
 * 返回一个闭包，调用时自动注入 requestId 并附加统一的错误日志处理。
 * 审计写入失败不会中断业务流程。
 *
 * @param {import('mongodb').Db} db
 * @param {object} config
 * @param {object} logger
 * @param {string} requestId
 * @returns {(event: object) => Promise<void>}
 */
export function createAuditAppender(db, config, logger, requestId) {
  return (event) =>
    appendAuditEvent(db, { ...event, requestId }, config)
      .catch((err) => logger.error('审计追加失败', { requestId, errorSummary: err.message }));
}
