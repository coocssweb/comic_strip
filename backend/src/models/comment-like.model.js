import mongoose from 'mongoose';

const commentLikeSchema = new mongoose.Schema(
  {
    readerId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Reader' },
    commentId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Comment' },
  },
  { timestamps: true, collection: 'comment_likes' },
);

commentLikeSchema.index({ readerId: 1, commentId: 1 }, { unique: true });

export const CommentLike = mongoose.model('CommentLike', commentLikeSchema);
