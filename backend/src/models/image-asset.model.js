// 图片资产数据模型 — Mogoose Schema 定义 + 数据库级 JSON Schema 校验

import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

/** 集合名称 */
export const IMAGE_ASSET_COLLECTION = 'image_assets';

/**
 * Mongoose Schema：严格模式，禁用 __v，_id 使用 UUID v4
 */
const imageAssetSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: uuidv4,
    },
    // COS 对象 key，全局唯一
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    // 文件大小（字节）
    size: {
      type: Number,
      required: true,
      min: 0,
    },
    // 图片宽度（像素）
    width: {
      type: Number,
      required: true,
      min: 1,
    },
    // 图片高度（像素）
    height: {
      type: Number,
      required: true,
      min: 1,
    },
    // COS 对象 ETag
    etag: {
      type: String,
      required: true,
    },
    // 上传确认时间
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    strict: true,
    versionKey: false,
  },
);

/** 数据库级 JSON Schema 校验器 — 最终存储防线 */
export const IMAGE_ASSET_JSON_SCHEMA = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['key', 'size', 'width', 'height', 'etag'],
    additionalProperties: false,
    properties: {
      _id: { bsonType: 'string' },
      key: { bsonType: 'string' },
      size: { bsonType: 'int', minimum: 0 },
      width: { bsonType: 'int', minimum: 1 },
      height: { bsonType: 'int', minimum: 1 },
      etag: { bsonType: 'string' },
      uploadedAt: { bsonType: 'date' },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: 'date' },
    },
  },
};

const ImageAsset = mongoose.model('ImageAsset', imageAssetSchema, IMAGE_ASSET_COLLECTION);

export default ImageAsset;
