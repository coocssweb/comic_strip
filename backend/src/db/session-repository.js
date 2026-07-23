import { createHash } from 'node:crypto';

export function computeCsrfTokenHash(csrfToken) {
  return createHash('sha256').update(csrfToken).digest('base64url');
}

/**
 * 创建并持久化管理会话记录。
 *
 * @param {import('mongodb').Db} db
 * @param {{
 *   jti: string,
 *   sessionGeneration: number,
 *   csrfToken: string,
 *   now?: Date,
 *   idleExpiresAt?: Date,
 *   absoluteExpiresAt?: Date,
 * }} options
 * @returns {Promise<object>}
 */
export async function createAdminSession(db, {
  jti,
  sessionGeneration,
  csrfToken,
  now = new Date(),
  idleExpiresAt = new Date(now.getTime() + 30 * 60 * 1000),
  absoluteExpiresAt = new Date(now.getTime() + 12 * 60 * 60 * 1000),
}) {
  const sessionDoc = {
    _id: jti,
    sessionGeneration,
    csrfTokenHash: computeCsrfTokenHash(csrfToken),
    createdAt: now,
    lastSeenAt: now,
    idleExpiresAt,
    absoluteExpiresAt,
  };

  await db.collection('admin_sessions').insertOne(sessionDoc);
  return sessionDoc;
}

/**
 * 查找指定 jti 的管理会话记录。
 *
 * @param {import('mongodb').Db} db
 * @param {string} jti
 * @returns {Promise<object | null>}
 */
export async function findAdminSession(db, jti) {
  return db.collection('admin_sessions').findOne({ _id: jti });
}

/**
 * 删除指定 jti 的管理会话记录。
 *
 * @param {import('mongodb').Db} db
 * @param {string} jti
 * @returns {Promise<void>}
 */
export async function deleteAdminSession(db, jti) {
  await db.collection('admin_sessions').deleteOne({ _id: jti });
}

/**
 * 5分钟采样滑动延期管理会话。
 *
 * @param {import('mongodb').Db} db
 * @param {string} jti
 * @param {Date} now
 * @param {Date} newIdleExpiresAt
 * @returns {Promise<void>}
 */
export async function touchAdminSession(db, jti, now, newIdleExpiresAt) {
  await db.collection('admin_sessions').updateOne(
    { _id: jti },
    {
      $set: {
        lastSeenAt: now,
        idleExpiresAt: newIdleExpiresAt,
      },
    },
  );
}
