import { isDeepStrictEqual } from 'node:util';

export const ADMINS_COLLECTION_DEFINITION = Object.freeze({
  name: 'admins',
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['_id', 'username', 'passwordHash', 'sessionGeneration', 'createdAt', 'updatedAt'],
      additionalProperties: false,
      properties: {
        _id: { bsonType: 'string', enum: ['primary-admin'] },
        username: { bsonType: 'string', minLength: 3, maxLength: 64, pattern: '^[a-z0-9][a-z0-9._-]*[a-z0-9]$' },
        passwordHash: { bsonType: 'string', minLength: 1 },
        sessionGeneration: { bsonType: 'number', minimum: 1 },
        createdAt: { bsonType: 'date' },
        updatedAt: { bsonType: 'date' },
      },
    },
  },
  indexes: Object.freeze([]),
});

export const SECURITY_AUDITS_COLLECTION_DEFINITION = Object.freeze({
  name: 'security_audits',
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['occurredAt', 'eventType', 'outcome', 'actorType', 'requestId'],
      additionalProperties: false,
      properties: {
        _id: { bsonType: 'objectId' },
        occurredAt: { bsonType: 'date' },
        eventType: {
          bsonType: 'string',
          enum: [
            'ADMIN_INITIALIZATION',
            'ADMIN_LOGIN',
            'ADMIN_LOGOUT',
            'ADMIN_PASSWORD_CHANGE',
            'ADMIN_ACCESS_RECOVERY',
            'ADMIN_SESSION_REVOCATION',
          ],
        },
        outcome: { bsonType: 'string', enum: ['succeeded', 'failed', 'throttled'] },
        actorType: { bsonType: 'string', enum: ['anonymous', 'admin', 'trusted_operator', 'system'] },
        requestId: { bsonType: 'string' },
        adminId: { bsonType: 'string' },
        sessionIdHash: { bsonType: 'string' },
        sourceIpHash: { bsonType: 'string' },
        credentialKeyHash: { bsonType: 'string' },
        reasonCode: { bsonType: 'string' },
        sessionGeneration: { bsonType: 'number' },
        revocationScope: { bsonType: 'string', enum: ['current', 'all'] },
      },
    },
  },
  indexes: Object.freeze([
    { name: 'occurredAt_1', key: { occurredAt: 1 } },
    { name: 'requestId_1', key: { requestId: 1 } },
    { name: 'eventType_1_occurredAt_1', key: { eventType: 1, occurredAt: 1 } },
  ]),
});

export const ADMIN_SESSIONS_COLLECTION_DEFINITION = Object.freeze({
  name: 'admin_sessions',
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['_id', 'sessionGeneration', 'csrfTokenHash', 'createdAt', 'lastSeenAt', 'idleExpiresAt', 'absoluteExpiresAt'],
      additionalProperties: false,
      properties: {
        _id: { bsonType: 'string' },
        sessionGeneration: { bsonType: 'number', minimum: 1 },
        csrfTokenHash: { bsonType: 'string' },
        createdAt: { bsonType: 'date' },
        lastSeenAt: { bsonType: 'date' },
        idleExpiresAt: { bsonType: 'date' },
        absoluteExpiresAt: { bsonType: 'date' },
      },
    },
  },
  indexes: Object.freeze([
    { name: 'idleExpiresAt_ttl', key: { idleExpiresAt: 1 }, expireAfterSeconds: 0 },
  ]),
});

export const ADMIN_THROTTLES_COLLECTION_DEFINITION = Object.freeze({
  name: 'admin_throttles',
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['_id', 'type', 'keyHash', 'tokens', 'updatedAt', 'expiresAt'],
      additionalProperties: false,
      properties: {
        _id: { bsonType: 'string' },
        type: { bsonType: 'string', enum: ['ip', 'username'] },
        keyHash: { bsonType: 'string' },
        tokens: { bsonType: 'number' },
        cooldownExpiresAt: { bsonType: 'date' },
        cooldownLevel: { bsonType: 'number' },
        lastDepletedAt: { bsonType: 'date' },
        updatedAt: { bsonType: 'date' },
        expiresAt: { bsonType: 'date' },
      },
    },
  },
  indexes: Object.freeze([
    { name: 'expiresAt_ttl', key: { expiresAt: 1 }, expireAfterSeconds: 0 },
  ]),
});

/** @type {ReadonlyArray<{name: string, validator: object, indexes: ReadonlyArray<object>}>} */
export const DEFAULT_COLLECTION_DEFINITIONS = Object.freeze([
  ADMINS_COLLECTION_DEFINITION,
  SECURITY_AUDITS_COLLECTION_DEFINITION,
  ADMIN_SESSIONS_COLLECTION_DEFINITION,
  ADMIN_THROTTLES_COLLECTION_DEFINITION,
]);

const INDEX_CONTRACT_OPTIONS = Object.freeze([
  'unique',
  'sparse',
  'expireAfterSeconds',
  'partialFilterExpression',
  'collation',
]);

class CollectionBaselineError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CollectionBaselineError';
  }
}

function expectedIndexView(definition) {
  return indexContractView(definition);
}

function indexContractView(index) {
  const view = { key: index.key, name: index.name };
  for (const optionName of INDEX_CONTRACT_OPTIONS) {
    if (index[optionName] !== undefined) {
      view[optionName] = index[optionName];
    }
  }
  return view;
}

function verifyIndexSet(actualIndexes, expectedIndexes) {
  const expectedNames = new Set(expectedIndexes.map(({ name }) => name));
  const unexpectedIndex = actualIndexes.find(({ name }) => name !== '_id_' && !expectedNames.has(name));
  if (unexpectedIndex) {
    throw new CollectionBaselineError('集合索引与声明不一致');
  }

  for (const expectedIndex of expectedIndexes) {
    const actualIndex = actualIndexes.find(({ name }) => name === expectedIndex.name);
    if (!actualIndex || !isDeepStrictEqual(indexContractView(actualIndex), expectedIndexView(expectedIndex))) {
      throw new CollectionBaselineError('集合索引与声明不一致');
    }
  }
}

async function ensureCollection(db, definition) {
  const [existingCollection] = await db.listCollections({ name: definition.name }).toArray();
  if (existingCollection) {
    await db.command({
      collMod: definition.name,
      validator: definition.validator,
      validationLevel: 'strict',
      validationAction: 'error',
    });
  } else {
    await db.createCollection(definition.name, {
      validator: definition.validator,
      validationLevel: 'strict',
      validationAction: 'error',
    });
  }

  const collection = db.collection(definition.name);
  const actualIndexes = await collection.listIndexes().toArray();
  for (const indexDefinition of definition.indexes) {
    const existingIndex = actualIndexes.find(({ name }) => name === indexDefinition.name);
    if (existingIndex) {
      verifyIndexSet([existingIndex], [indexDefinition]);
      continue;
    }

    const { key, ...options } = indexDefinition;
    await collection.createIndex(key, options);
  }
}

async function verifyCollection(db, definition) {
  const [actualCollection] = await db.listCollections({ name: definition.name }).toArray();
  if (!actualCollection || !isDeepStrictEqual(actualCollection.options?.validator ?? {}, definition.validator)) {
    throw new CollectionBaselineError('集合校验器与声明不一致');
  }
  if (actualCollection.options?.validationLevel !== 'strict'
    || actualCollection.options?.validationAction !== 'error') {
    throw new CollectionBaselineError('集合校验器与执行模式不一致');
  }

  const actualIndexes = await db.collection(definition.name).listIndexes().toArray();
  verifyIndexSet(actualIndexes, definition.indexes);
}

async function runWithSafeDatabaseError(operation, safeMessage) {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof CollectionBaselineError) {
      throw error;
    }
    throw new CollectionBaselineError(safeMessage);
  }
}

/**
 * 集合定义注册表。
 *
 * @param {{definitions?: ReadonlyArray<{name: string, validator: object, indexes: ReadonlyArray<object>}>}} options
 * @returns {Readonly<{
 *   definitions: ReadonlyArray<{name: string, validator: object, indexes: ReadonlyArray<object>}>,
 *   ensure: (db: import('mongodb').Db) => Promise<void>,
 *   verify: (db: import('mongodb').Db) => Promise<void>,
 * }>}
 */
export function createCollectionRegistry({ definitions = DEFAULT_COLLECTION_DEFINITIONS } = {}) {
  const collectionDefinitions = Object.freeze([...definitions]);

  return Object.freeze({
    definitions: collectionDefinitions,
    async ensure(db) {
      await runWithSafeDatabaseError(async () => {
        for (const definition of collectionDefinitions) {
          await ensureCollection(db, definition);
        }
      }, '集合基线建立失败');
    },
    async verify(db) {
      await runWithSafeDatabaseError(async () => {
        await db.command({ ping: 1 });
        for (const definition of collectionDefinitions) {
          await verifyCollection(db, definition);
        }
      }, '集合基线核验失败');
    },
  });
}
