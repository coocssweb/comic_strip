import mongoose from 'mongoose';

const episodeShareSchema = new mongoose.Schema(
  {
    episodeId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Episode' },
    readerId: { type: mongoose.Schema.Types.ObjectId, default: null, ref: 'Reader' },
  },
  { timestamps: true, collection: 'episode_shares' },
);

episodeShareSchema.index({ episodeId: 1, createdAt: -1 });

export const EpisodeShare = mongoose.model('EpisodeShare', episodeShareSchema);
