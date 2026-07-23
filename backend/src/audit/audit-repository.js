import { createHmac } from 'node:crypto';

function computeHmacHash(secret, value) {
  if (!secret || !value) {
    return undefined;
  }
  const secretBuffer = Buffer.isBuffer(secret) ? secret : Buffer.from(secret);
  return createHmac('sha256', secretBuffer).update(value).digest('base64url');
}

/**
 * 向 security_audits 集合追加一条只读安全审计记录。
 *
 * @param {import('mongodb').Db} db
 * @param {{
 *   eventType: string,
 *   outcome: 'succeeded' | 'failed' | 'throttled',
 *   actorType: 'anonymous' | 'admin' | 'trusted_operator' | 'system',
 *   requestId: string,
 *   adminId?: string,
 *   username?: string,
 *   sessionId?: string,
 *   sourceIp?: string,
 *   reasonCode?: string,
 *   sessionGeneration?: number,
 *   revocationScope?: 'current' | 'all',
 *   occurredAt?: Date,
 * }} auditData
 * @param {{securityHmacSecret?: Buffer | string}} [config]
 * @returns {Promise<object>} 插入的审计文档
 */
export async function appendAuditEvent(db, auditData, config = {}) {
  const {
    eventType,
    outcome,
    actorType,
    requestId,
    adminId,
    username,
    sessionId,
    sourceIp,
    reasonCode,
    sessionGeneration,
    revocationScope,
    occurredAt = new Date(),
  } = auditData;

  const doc = {
    occurredAt,
    eventType,
    outcome,
    actorType,
    requestId,
  };

  if (adminId !== undefined) {
    doc.adminId = adminId;
  }
  if (username !== undefined && config.securityHmacSecret) {
    doc.credentialKeyHash = computeHmacHash(config.securityHmacSecret, username.toLowerCase());
  }
  if (sessionId !== undefined && config.securityHmacSecret) {
    doc.sessionIdHash = computeHmacHash(config.securityHmacSecret, sessionId);
  }
  if (sourceIp !== undefined && config.securityHmacSecret) {
    doc.sourceIpHash = computeHmacHash(config.securityHmacSecret, sourceIp);
  }
  if (reasonCode !== undefined) {
    doc.reasonCode = reasonCode;
  }
  if (sessionGeneration !== undefined) {
    doc.sessionGeneration = sessionGeneration;
  }
  if (revocationScope !== undefined) {
    doc.revocationScope = revocationScope;
  }

  await db.collection('security_audits').insertOne(doc);
  return doc;
}
