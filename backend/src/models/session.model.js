// 管理员会话数据模型 — 用于 tracking JWT 会话状态、CSRF token 和空闲超时

import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

/** 字段名常量 */
export const SESSION_FIELDS = {
  _id: '_id',
  adminId: 'adminId',
  csrfToken: 'csrfToken',
  sessionGeneration: 'sessionGeneration',
  idleExpiresAt: 'idleExpiresAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

const sessionSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: uuidv4,
    },
    adminId: {
      type: String,
      required: true,
      index: true,
    },
    csrfToken: {
      type: String,
      required: true,
    },
    sessionGeneration: {
      type: Number,
      required: true,
      min: 1,
    },
    idleExpiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
    strict: true,
    versionKey: false,
  },
);

/** 数据库级 JSON Schema 校验器 */
export const SESSION_JSON_SCHEMA = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['adminId', 'csrfToken', 'sessionGeneration', 'idleExpiresAt'],
    additionalProperties: false,
    properties: {
      _id: { bsonType: 'string' },
      adminId: { bsonType: 'string' },
      csrfToken: { bsonType: 'string' },
      sessionGeneration: { bsonType: 'int', minimum: 1 },
      idleExpiresAt: { bsonType: 'date' },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: 'date' },
    },
  },
};

/** 集合名称 */
export const SESSION_COLLECTION = 'admin_sessions';

const Session = mongoose.model('AdminSession', sessionSchema, SESSION_COLLECTION);

export default Session;
