// 漫画数据模型 — Mongoose Schema 定义 + 数据库级 JSON Schema 校验

import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

/** 漫画状态枚举 */
export const COMIC_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  UNPUBLISHED: 'unpublished',
  DELETED: 'deleted',
};

export const COMIC_STATUS_VALUES = Object.values(COMIC_STATUS);

/** 字段名常量，避免魔法字符串散落在业务逻辑中 */
export const COMIC_FIELDS = {
  _id: '_id',
  title: 'title',
  seriesId: 'seriesId',
  status: 'status',
  cover: 'cover',
  bodyImages: 'bodyImages',
  tags: 'tags',
  likeCount: 'likeCount',
  favoriteCount: 'favoriteCount',
  commentCount: 'commentCount',
  publishedAt: 'publishedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

/**
 * Mongoose Schema：严格模式，禁 __v，_id 使用 UUID v4
 */
const comicSchema = new mongoose.Schema(
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
    seriesId: {
      type: String,
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: COMIC_STATUS_VALUES,
      default: COMIC_STATUS.DRAFT,
      index: true,
    },
    // 封面图片 COS key
    cover: {
      type: String,
      default: null,
    },
    // 正文图片 COS key 数组
    bodyImages: {
      type: [String],
      default: [],
    },
    // 标签数组，直接存储不校验标签是否存在
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    likeCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    favoriteCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    commentCount: {
      type: Number,
      default: 0,
      min: 0,
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
export const COMIC_JSON_SCHEMA = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['title'],
    additionalProperties: false,
    properties: {
      _id: { bsonType: 'string' },
      title: { bsonType: 'string' },
      seriesId: {
        bsonType: ['string', 'null'],
      },
      status: {
        enum: COMIC_STATUS_VALUES,
      },
      cover: {
        bsonType: ['string', 'null'],
      },
      bodyImages: {
        bsonType: 'array',
        items: { bsonType: 'string' },
      },
      tags: {
        bsonType: 'array',
        items: { bsonType: 'string' },
      },
      likeCount: { bsonType: 'int', minimum: 0 },
      favoriteCount: { bsonType: 'int', minimum: 0 },
      commentCount: { bsonType: 'int', minimum: 0 },
      publishedAt: {
        bsonType: ['date', 'null'],
      },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: 'date' },
    },
  },
};

/** 集合名称 */
export const COMIC_COLLECTION = 'comics';

const Comic = mongoose.model('Comic', comicSchema, COMIC_COLLECTION);

export default Comic;
