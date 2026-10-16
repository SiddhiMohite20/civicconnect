import mongoose from 'mongoose';
const { Schema } = mongoose;
const schema = new Schema({
  organization: { type: Schema.Types.ObjectId, index: true },
  actor: { type: Schema.Types.ObjectId, ref: 'User' },
  actorName: String,
  action: { type: String, required: true },
  entityType: String,
  entityId: Schema.Types.ObjectId,
  meta: Schema.Types.Mixed,
  ip: String,
}, { timestamps: { createdAt: true, updatedAt: false } });
schema.index({ organization: 1, createdAt: -1 });
export const AuditLog = mongoose.model('AuditLog', schema);
