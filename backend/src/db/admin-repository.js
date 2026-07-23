/**
 * 唯一管理员仓储模块：固化 _id = "primary-admin"。
 */

export const PRIMARY_ADMIN_ID = 'primary-admin';

/**
 * 查找唯一管理员文档。
 *
 * @param {import('mongodb').Db} db
 * @returns {Promise<object | null>}
 */
export async function findPrimaryAdmin(db) {
  return db.collection('admins').findOne({ _id: PRIMARY_ADMIN_ID });
}

/**
 * 插入唯一管理员文档（_id 唯一约束拦截重复创建）。
 *
 * @param {import('mongodb').Db} db
 * @param {{username: string, passwordHash: string}} adminData
 * @returns {Promise<object>} 插入成功返回的管理员文档
 */
export async function createPrimaryAdmin(db, { username, passwordHash }) {
  const now = new Date();
  const adminDoc = {
    _id: PRIMARY_ADMIN_ID,
    username,
    passwordHash,
    sessionGeneration: 1,
    createdAt: now,
    updatedAt: now,
  };
  await db.collection('admins').insertOne(adminDoc);
  return adminDoc;
}

/**
 * 原子更新唯一管理员密码与登录名，并递增会话世代。
 *
 * @param {import('mongodb').Db} db
 * @param {{expectedGeneration: number, newPasswordHash: string, newUsername?: string, now?: Date}} options
 * @returns {Promise<{updated: boolean, newGeneration?: number}>}
 */
export async function updatePrimaryAdminPassword(db, { expectedGeneration, newPasswordHash, newUsername, now = new Date() }) {
  const setDoc = {
    passwordHash: newPasswordHash,
    updatedAt: now,
  };
  if (newUsername) {
    setDoc.username = newUsername;
  }

  const result = await db.collection('admins').findOneAndUpdate(
    { _id: PRIMARY_ADMIN_ID, sessionGeneration: expectedGeneration },
    {
      $set: setDoc,
      $inc: {
        sessionGeneration: 1,
      },
    },
    { returnDocument: 'after' },
  );

  if (!result) {
    return { updated: false };
  }

  return { updated: true, newGeneration: result.sessionGeneration };
}
