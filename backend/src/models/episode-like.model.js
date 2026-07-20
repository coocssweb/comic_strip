import mongoose from 'mongoose';

const episodeLikeSchema = new mongoose.Schema(
  {
    readerId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Reader' },
    episodeId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Episode' },
  },
  { timestamps: true, collection: 'episode_likes' },
);

episodeLikeSchema.index({ readerId: 1, episodeId: 1 }, { unique: true });

export const EpisodeLike = mongoose.model('EpisodeLike', episodeLikeSchema);
