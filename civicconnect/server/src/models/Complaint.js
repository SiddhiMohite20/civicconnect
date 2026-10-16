import mongoose from 'mongoose';
import crypto from 'node:crypto';
const { Schema } = mongoose;

export const STATUSES = ['submitted', 'under_review', 'assigned', 'in_progress', 'resolved', 'rejected', 'reopened', 'closed'];
export const PRIORITIES = ['low', 'medium', 'high', 'critical'];

const image = new Schema({ url: String, publicId: String, bytes: Number, format: String }, { _id: false });

const schema = new Schema({
  ref: { type: String, unique: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, required: true, trim: true, maxlength: 2000 },
  category: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
  organization: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  jurisdiction: { type: Schema.Types.ObjectId, required: true },
  jurisdictionName: String,
  reporter: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point', required: true },
    coordinates: { type: [Number], required: true, validate: (v) => v.length === 2 && Math.abs(v[0]) <= 180 && Math.abs(v[1]) <= 90 },
  },
  address: { type: String, maxlength: 300 },
  landmark: { type: String, maxlength: 150 },
  images: { type: [image], default: [] },
  status: { type: String, enum: STATUSES, default: 'submitted' },
  priority: {
    level: { type: String, enum: PRIORITIES, default: 'medium' },
    reason: String,
    by: { type: Schema.Types.ObjectId, ref: 'User' },
    at: Date,
  },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
  history: [{
    from: String, to: String,
    actor: { type: Schema.Types.ObjectId, ref: 'User' },
    actorName: String, actorRole: String,
    note: String,
    at: { type: Date, default: Date.now },
    _id: false,
  }],
  resolution: { note: String, images: { type: [image], default: [] }, by: { type: Schema.Types.ObjectId, ref: 'User' }, at: Date },
  resolvedAt: Date,
  closedAt: Date,
  reopenCount: { type: Number, default: 0 },
  idempotencyKey: String,
  duplicateSuspectOf: { type: Schema.Types.ObjectId, ref: 'Complaint' },
  flag: { type: { type: String, enum: ['spam', 'duplicate'] }, note: String, by: Schema.Types.ObjectId, at: Date, duplicateOf: Schema.Types.ObjectId },
  isHidden: { type: Boolean, default: false }, // hidden from public map
}, { timestamps: true });

schema.pre('validate', function (next) {
  if (!this.ref) this.ref = `CC-${new Date().getFullYear()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  next();
});
schema.index({ location: '2dsphere' });
schema.index({ organization: 1, status: 1, createdAt: -1 });
schema.index({ organization: 1, jurisdiction: 1, createdAt: -1 });
schema.index({ reporter: 1, createdAt: -1 });
schema.index({ assignedTo: 1, status: 1 });
schema.index({ reporter: 1, idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } });

export const Complaint = mongoose.model('Complaint', schema);
