import mongoose from 'mongoose';

const episodeFavoriteSchema = new mongoose.Schema(
  {
    readerId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Reader' },
    episodeId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Episode' },
  },
  { timestamps: true, collection: 'episode_favorites' },
);

episodeFavoriteSchema.index({ readerId: 1, episodeId: 1 }, { unique: true });

export const EpisodeFavorite = mongoose.model('EpisodeFavorite', episodeFavoriteSchema);
