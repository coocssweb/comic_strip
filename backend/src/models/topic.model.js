import mongoose from 'mongoose';

const topicSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    summary: { type: String, default: null, trim: true },
    coverImageUrl: { type: String, required: true, trim: true },
    episodeIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Episode', required: true }],
  },
  { timestamps: true, collection: 'editorial_topics' },
);

export const Topic = mongoose.model('Topic', topicSchema);
