import mongoose from 'mongoose';
const { Schema } = mongoose;

const userSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 160 },
  phone: { type: String, trim: true, maxlength: 20 },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['resident', 'staff', 'admin'], default: 'resident', index: true },
  organization: { type: Schema.Types.ObjectId, ref: 'Organization', index: true },
  jurisdiction: { type: Schema.Types.ObjectId }, // resident's home ward
  jurisdictions: { type: [Schema.Types.ObjectId], default: [] }, // staff scope; empty = organization-wide
  isActive: { type: Boolean, default: true },
  suspendedReason: String,
  refreshTokens: { type: [{ hash: String, expires: Date, _id: false }], select: false, default: [] },
}, { timestamps: true });

userSchema.index({ 'refreshTokens.hash': 1 });
userSchema.set('toJSON', {
  transform: (_d, r) => { delete r.passwordHash; delete r.refreshTokens; delete r.__v; return r; },
});
export const User = mongoose.model('User', userSchema);
