import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema(
  {
    readerId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Reader' },
    episodeId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Episode' },
    content: { type: String, required: true, trim: true },
    deletedAt: { type: Date, default: null },
    deletedByRole: { type: String, enum: ['reader', 'admin'], default: null },
    deletedById: { type: String, default: null },
  },
  { timestamps: true, collection: 'comments' },
);

commentSchema.index({ episodeId: 1, deletedAt: 1, createdAt: -1, _id: -1 });
commentSchema.index({ readerId: 1, deletedAt: 1, createdAt: -1, _id: -1 });
commentSchema.index(
  { deletedAt: 1, createdAt: -1, _id: -1 },
  {
    name: 'active_comments_by_deleted_at_created_at',
    partialFilterExpression: { deletedAt: null },
  },
);
commentSchema.index(
  { createdAt: -1, _id: -1, deletedAt: 1 },
  {
    name: 'deleted_comments_by_created_at_deleted_at',
    partialFilterExpression: { deletedAt: { $type: 'date' } },
  },
);

export const LEGACY_ACTIVE_COMMENT_INDEX = 'active_comments_by_created_at';
export const Comment = mongoose.model('Comment', commentSchema);
