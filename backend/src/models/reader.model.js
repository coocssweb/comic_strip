import mongoose from 'mongoose';

const readerSchema = new mongoose.Schema(
  {
    wechatOpenId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
      default: '微信读者',
    },
    avatarUrl: {
      type: String,
      default: null,
    },
    lastLoginAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true },
);

export const Reader = mongoose.model('Reader', readerSchema);
