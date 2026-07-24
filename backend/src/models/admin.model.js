// 管理员数据模型 — Mongoose Schema 定义 + 数据库级 JSON Schema 校验

import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

/**
 * 字段名常量，避免魔法字符串散落在业务逻辑中
 */
export const ADMIN_FIELDS = {
  _id: '_id',
  username: 'username',
  passwordHash: 'passwordHash',
  sessionGeneration: 'sessionGeneration',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

/**
 * Mongoose Schema：严格模式，禁用 __v，_id 使用 UUID v4
 */
const adminSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: uuidv4,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    sessionGeneration: {
      type: Number,
      default: 1,
      min: 1,
    },
  },
  {
    timestamps: true, // 自动管理 createdAt / updatedAt
    strict: true,     // 拒绝未在 Schema 中声明的字段
    versionKey: false, // 禁用 __v
  },
);

/**
 * 数据库级 JSON Schema 校验器 — 最终存储防线
 * 只允许 _id、username、passwordHash、sessionGeneration、createdAt、updatedAt 六个字段
 */
export const ADMIN_JSON_SCHEMA = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['username', 'passwordHash'],
    additionalProperties: false,
    properties: {
      _id: { bsonType: 'string' },
      username: { bsonType: 'string' },
      passwordHash: { bsonType: 'string' },
      sessionGeneration: { bsonType: 'int', minimum: 1 },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: 'date' },
    },
  },
};

/** 集合名称 */
export const ADMIN_COLLECTION = 'admins';

const Admin = mongoose.model('Admin', adminSchema, ADMIN_COLLECTION);

export default Admin;
