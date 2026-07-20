import mongoose from 'mongoose';

const tagSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    sortOrder: { type: Number, required: true, min: 0 },
  },
  { timestamps: true, collection: 'comic_tags' },
);

tagSchema.index({ sortOrder: 1, _id: 1 });

export const Tag = mongoose.model('Tag', tagSchema);
