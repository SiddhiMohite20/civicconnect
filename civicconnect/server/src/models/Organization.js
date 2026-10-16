import mongoose from 'mongoose';
const { Schema } = mongoose;
const orgSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  isActive: { type: Boolean, default: true },
  jurisdictions: [{ name: { type: String, required: true, trim: true, maxlength: 80 }, isActive: { type: Boolean, default: true } }],
}, { timestamps: true });
export const Organization = mongoose.model('Organization', orgSchema);
