import mongoose from 'mongoose';
const { Schema } = mongoose;
const schema = new Schema({
  complaint: { type: Schema.Types.ObjectId, ref: 'Complaint', required: true, index: true },
  author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  authorRole: { type: String, enum: ['resident', 'staff', 'admin'], required: true },
  text: { type: String, required: true, trim: true, maxlength: 2000 },
  visibility: { type: String, enum: ['public', 'internal'], default: 'public' }, // internal = staff only
}, { timestamps: true });
export const Comment = mongoose.model('Comment', schema);
