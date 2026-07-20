import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema(
  {
    tokenDigest: {
      type: String,
      required: true,
      unique: true,
    },
    role: {
      type: String,
      enum: ['reader', 'admin'],
      required: true,
    },
    subjectId: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
    revokedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

sessionSchema.index({ role: 1, subjectId: 1, tokenDigest: 1 });

export const Session = mongoose.model('Session', sessionSchema);
