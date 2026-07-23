import { isDeepStrictEqual } from 'node:util';

/** @type {ReadonlyArray<{name: string, validator: object, indexes: ReadonlyArray<object>}>} */
export const DEFAULT_COLLECTION_DEFINITIONS = Object.freeze([]);
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
 * 集合定义可注入，当前生产注册表为空，后续切片再添加权威集合定义。
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
