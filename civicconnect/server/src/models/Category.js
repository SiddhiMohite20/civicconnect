import mongoose from 'mongoose';
const { Schema } = mongoose;
const schema = new Schema({
  organization: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 60 },
  color: { type: String, default: '#64748b', match: /^#[0-9a-fA-F]{6}$/ },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });
schema.index({ organization: 1, name: 1 }, { unique: true });
export const Category = mongoose.model('Category', schema);
