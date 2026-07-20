import mongoose from 'mongoose';
import { EPISODE_STATUS } from '../content/episode-rules.js';

const panelSchema = new mongoose.Schema(
  {
    position: { type: Number, required: true, min: 1, max: 4 },
    imageUrl: { type: String, required: true, trim: true },
    altText: { type: String, default: null, trim: true },
  },
  { _id: false },
);

const episodeSchema = new mongoose.Schema(
  {
    seriesId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'ComicSeries' },
    title: { type: String, required: true, trim: true },
    summary: { type: String, default: null, trim: true },
    themeTagId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Tag' },
    panels: { type: [panelSchema], required: true },
    status: {
      type: String,
      required: true,
      enum: Object.values(EPISODE_STATUS),
      default: EPISODE_STATUS.DRAFT,
    },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'comic_episodes' },
);

episodeSchema.index({ status: 1, publishedAt: -1, _id: -1 });
episodeSchema.index({ seriesId: 1, status: 1, publishedAt: -1, _id: -1 });

export const Episode = mongoose.model('Episode', episodeSchema);
