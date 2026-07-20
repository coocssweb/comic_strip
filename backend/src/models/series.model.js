import mongoose from 'mongoose';

const seriesSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    summary: { type: String, required: true, trim: true },
    authorByline: { type: String, required: true, trim: true },
  },
  { timestamps: true, collection: 'comic_series' },
);

export const ComicSeries = mongoose.model('ComicSeries', seriesSchema);
