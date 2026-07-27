// 标签数据模型 — Mongoose Schema 定义 + 数据库级 JSON Schema 校验

import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

/** 标签可用状态枚举 */
export const TAG_STATUS = {
  ENABLED: 'enabled',
  DISABLED: 'disabled',
  DELETED: 'deleted',
};

export const TAG_STATUS_VALUES = Object.values(TAG_STATUS);

/**
 * Mongoose Schema：严格模式，禁 __v，_id 使用 UUID v4
 */
const tagSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: uuidv4,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 30,
    },
    status: {
      type: String,
      enum: TAG_STATUS_VALUES,
      default: TAG_STATUS.ENABLED,
      index: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    // 是否进入推荐标签名单
    isRecommended: {
      type: Boolean,
      default: false,
      index: true,
    },
    // 推荐标签名单中的展示顺序
    recommendedOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    strict: true,
    versionKey: false,
  },
);

// 启用和停用标签之间 name 唯一；已删除标签不参与唯一约束
tagSchema.index(
  { name: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $ne: TAG_STATUS.DELETED } },
  },
);

/** 数据库级 JSON Schema 校验器 — 最终存储防线 */
export const TAG_JSON_SCHEMA = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['name'],
    additionalProperties: false,
    properties: {
      _id: { bsonType: 'string' },
      name: { bsonType: 'string' },
      status: { enum: TAG_STATUS_VALUES },
      sortOrder: { bsonType: 'int' },
      isRecommended: { bsonType: 'bool' },
      recommendedOrder: { bsonType: 'int' },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: 'date' },
    },
  },
};

/** 集合名称 */
export const TAG_COLLECTION = 'tags';

const Tag = mongoose.model('Tag', tagSchema, TAG_COLLECTION);

export default Tag;
