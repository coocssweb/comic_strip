// 连载数据模型 — Mongoose Schema 定义 + 数据库级 JSON Schema 校验

import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

/** 连载状态枚举 — 与漫画状态流转保持一致 */
export const SERIES_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  UNPUBLISHED: 'unpublished',
  DELETED: 'deleted',
};

export const SERIES_STATUS_VALUES = Object.values(SERIES_STATUS);

/** 连载成员漫画子文档 Schema */
const seriesComicSchema = new mongoose.Schema(
  {
    comicId: { type: String, required: true },
    order: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

/**
 * Mongoose Schema：严格模式，禁 __v，_id 使用 UUID v4
 */
const seriesSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: uuidv4,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 100,
    },
    status: {
      type: String,
      enum: SERIES_STATUS_VALUES,
      default: SERIES_STATUS.DRAFT,
      index: true,
    },
    // 是否已完结 — 与内容生命周期独立，草稿连载也可以标记完结
    isCompleted: {
      type: Boolean,
      default: false,
    },
    // 成员漫画列表，按 order 排序
    comics: {
      type: [seriesComicSchema],
      default: [],
    },
    // 发布时间，仅 published 状态时有值
    publishedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    strict: true,
    versionKey: false,
  },
);

/** 数据库级 JSON Schema 校验器 — 最终存储防线 */
export const SERIES_JSON_SCHEMA = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['title'],
    additionalProperties: false,
    properties: {
      _id: { bsonType: 'string' },
      title: { bsonType: 'string' },
      status: { enum: SERIES_STATUS_VALUES },
      isCompleted: { bsonType: 'bool' },
      comics: {
        bsonType: 'array',
        items: {
          bsonType: 'object',
          required: ['comicId', 'order'],
          additionalProperties: false,
          properties: {
            comicId: { bsonType: 'string' },
            order: { bsonType: 'int', minimum: 0 },
          },
        },
      },
      publishedAt: { bsonType: ['date', 'null'] },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: 'date' },
    },
  },
};

/** 集合名称 */
export const SERIES_COLLECTION = 'series';

const Series = mongoose.model('Series', seriesSchema, SERIES_COLLECTION);

export default Series;
