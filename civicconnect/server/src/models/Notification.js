import mongoose from 'mongoose';
const { Schema } = mongoose;
const schema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, required: true },
  title: { type: String, required: true, maxlength: 200 },
  body: { type: String, maxlength: 400 },
  complaint: { type: Schema.Types.ObjectId, ref: 'Complaint' },
  readAt: Date,
}, { timestamps: true });
schema.index({ user: 1, createdAt: -1 });
export const Notification = mongoose.model('Notification', schema);
