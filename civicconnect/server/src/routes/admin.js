import { Router } from 'express';
import { body, query } from 'express-validator';
import bcrypt from 'bcrypt';
import { User } from '../models/User.js';
import { Organization } from '../models/Organization.js';
import { Category } from '../models/Category.js';
import { Complaint } from '../models/Complaint.js';
import { AuditLog } from '../models/AuditLog.js';
import { authenticate, authorize, csrfProtect } from '../middleware/auth.js';
import { ApiError, asyncHandler, validate, isId, escapeRegex } from '../utils/http.js';
import { audit } from '../services/audit.js';
import { disconnectUser } from '../sockets/emit.js';
import { nextStatuses, checkTransition, applyTransition } from '../services/workflow.js';
import { notifyUsers, safely } from '../services/notify.js';
import { emitToComplaintAudience } from '../sockets/emit.js';

const router = Router();
router.use(authenticate, authorize('admin'), csrfProtect);
const pw = body('password').isString().isLength({ min: 8, max: 128 }).matches(/[A-Za-z]/).matches(/\d/);

const orgUser = async (req) => {
  if (!isId(req.params.id)) throw new ApiError(404, 'User not found');
  const u = await User.findOne({ _id: req.params.id, organization: req.user.organization });
  if (!u) throw new ApiError(404, 'User not found');
  return u;
};
const orgWards = async (req) => (await Organization.findById(req.user.organization)).jurisdictions.map((j) => String(j._id));

// ----- users -----
router.get('/users', [query('role').optional().isIn(['resident', 'staff', 'admin']), query('q').optional().isString().isLength({ max: 80 }), query('page').optional().isInt({ min: 1 })], validate,
  asyncHandler(async (req, res) => {
    const f = { organization: req.user.organization };
    if (req.query.role) f.role = req.query.role;
    if (req.query.q) { const rx = new RegExp(escapeRegex(req.query.q), 'i'); f.$or = [{ name: rx }, { email: rx }]; }
    const page = Number(req.query.page) || 1;
    const [items, total] = await Promise.all([User.find(f).sort({ createdAt: -1 }).skip((page - 1) * 25).limit(25), User.countDocuments(f)]);
    res.json({ items, total, page, pages: Math.ceil(total / 25) });
  }));

router.post('/users', [body('name').isString().trim().isLength({ min: 2, max: 80 }), body('email').isEmail(), pw, body('role').isIn(['staff', 'admin']), body('jurisdictions').optional().isArray()], validate,
  asyncHandler(async (req, res) => {
    const wards = await orgWards(req);
    const js = (req.body.jurisdictions || []).filter((j) => wards.includes(String(j)));
    if (await User.exists({ email: req.body.email.toLowerCase() })) throw new ApiError(409, 'Email already in use', 'EMAIL_TAKEN');
    const u = await User.create({ name: req.body.name, email: req.body.email, passwordHash: await bcrypt.hash(req.body.password, 12), role: req.body.role, organization: req.user.organization, jurisdictions: js });
    await audit(req, 'user.create', 'User', u._id, req.user.organization, { role: u.role });
    res.status(201).json({ user: u });
  }));

router.patch('/users/:id', [body('role').optional().isIn(['resident', 'staff', 'admin']), body('jurisdictions').optional().isArray(), body('isActive').optional().isBoolean(), body('suspendedReason').optional().isString().isLength({ max: 300 })], validate,
  asyncHandler(async (req, res) => {
    const u = await orgUser(req);
    const self = String(u._id) === String(req.user._id);
    if (self && (req.body.role || req.body.isActive === false)) throw new ApiError(409, 'You cannot change your own role or suspend yourself', 'FORBIDDEN');
    if (req.body.role) u.role = req.body.role;
    if (req.body.jurisdictions) { const wards = await orgWards(req); u.jurisdictions = req.body.jurisdictions.filter((j) => wards.includes(String(j))); }
    if (req.body.isActive !== undefined) {
      u.isActive = req.body.isActive;
      u.suspendedReason = req.body.isActive ? undefined : req.body.suspendedReason || 'Suspended by administrator';
      if (!u.isActive) { await User.updateOne({ _id: u._id }, { $set: { refreshTokens: [] } }); disconnectUser(u._id); }
    }
    await u.save();
    await audit(req, 'user.update', 'User', u._id, req.user.organization, { changes: Object.keys(req.body) });
    res.json({ user: u });
  }));

// ----- setup: categories & wards -----
router.get('/setup', asyncHandler(async (req, res) => {
  const [organization, categories] = await Promise.all([Organization.findById(req.user.organization), Category.find({ organization: req.user.organization }).sort('name')]);
  res.json({ organization, categories });
}));
router.post('/categories', [body('name').isString().trim().isLength({ min: 2, max: 60 }), body('color').optional().matches(/^#[0-9a-fA-F]{6}$/)], validate, asyncHandler(async (req, res) => {
  const c = await Category.create({ organization: req.user.organization, name: req.body.name, color: req.body.color });
  await audit(req, 'category.create', 'Category', c._id, req.user.organization, { name: c.name });
  res.status(201).json({ category: c });
}));
router.patch('/categories/:id', [body('name').optional().isString().trim().isLength({ min: 2, max: 60 }), body('color').optional().matches(/^#[0-9a-fA-F]{6}$/), body('isActive').optional().isBoolean()], validate, asyncHandler(async (req, res) => {
  if (!isId(req.params.id)) throw new ApiError(404, 'Not found');
  const c = await Category.findOneAndUpdate({ _id: req.params.id, organization: req.user.organization }, { $set: req.body }, { new: true, runValidators: true });
  if (!c) throw new ApiError(404, 'Not found');
  await audit(req, 'category.update', 'Category', c._id, req.user.organization, { changes: Object.keys(req.body) });
  res.json({ category: c });
}));
router.post('/jurisdictions', [body('name').isString().trim().isLength({ min: 2, max: 80 })], validate, asyncHandler(async (req, res) => {
  const org = await Organization.findById(req.user.organization);
  org.jurisdictions.push({ name: req.body.name });
  await org.save();
  await audit(req, 'jurisdiction.create', 'Organization', org._id, org._id, { name: req.body.name });
  res.status(201).json({ organization: org });
}));
router.patch('/jurisdictions/:jid', [body('name').optional().isString().trim().isLength({ min: 2, max: 80 }), body('isActive').optional().isBoolean()], validate, asyncHandler(async (req, res) => {
  const org = await Organization.findById(req.user.organization);
  const j = org.jurisdictions.id(req.params.jid);
  if (!j) throw new ApiError(404, 'Not found');
  if (req.body.name !== undefined) j.name = req.body.name;
  if (req.body.isActive !== undefined) j.isActive = req.body.isActive;
  await org.save();
  await audit(req, 'jurisdiction.update', 'Organization', org._id, org._id, { jurisdiction: j._id, changes: Object.keys(req.body) });
  res.json({ organization: org });
}));

// ----- duplicate / spam review -----
router.get('/review-queue', asyncHandler(async (req, res) => {
  const items = await Complaint.find({ organization: req.user.organization, $or: [{ duplicateSuspectOf: { $exists: true, $ne: null } }, { 'flag.type': { $exists: true } }] })
    .sort({ createdAt: -1 }).limit(100).select('ref title status flag duplicateSuspectOf createdAt jurisdictionName').populate('duplicateSuspectOf', 'ref title').lean();
  res.json({ items });
}));
router.post('/complaints/:id/flag', [body('type').isIn(['spam', 'duplicate']), body('note').optional({ values: 'falsy' }).isString().isLength({ max: 300 })], validate, asyncHandler(async (req, res) => {
  if (!isId(req.params.id)) throw new ApiError(404, 'Not found');
  const c = await Complaint.findOne({ _id: req.params.id, organization: req.user.organization });
  if (!c) throw new ApiError(404, 'Not found');
  const note = req.body.note || `Marked as ${req.body.type}`;
  c.flag = { type: req.body.type, note, by: req.user._id, at: new Date(), duplicateOf: c.duplicateSuspectOf };
  c.isHidden = true;
  c.duplicateSuspectOf = undefined;
  const rejectable = nextStatuses(c.status).includes('rejected');
  if (rejectable) applyTransition(c, { to: 'rejected', actor: req.user, note: `Marked as ${req.body.type}: ${note}` });
  await c.save();
  await audit(req, `complaint.flag.${req.body.type}`, 'Complaint', c._id, c.organization, { rejected: rejectable });
  await safely(async () => {
    emitToComplaintAudience(c, 'complaint:updated', { id: String(c._id), ref: c.ref, status: c.status, reason: 'flag' });
    if (rejectable) await notifyUsers([c.reporter], { type: 'status_changed', title: `Complaint ${c.ref} was rejected`, body: `Reason: marked as ${req.body.type}`, complaint: c._id });
  });
  res.json({ ok: true, rejected: rejectable });
}));
router.post('/complaints/:id/dismiss', asyncHandler(async (req, res) => {
  if (!isId(req.params.id)) throw new ApiError(404, 'Not found');
  const r = await Complaint.updateOne({ _id: req.params.id, organization: req.user.organization }, { $unset: { duplicateSuspectOf: 1 } });
  if (!r.matchedCount) throw new ApiError(404, 'Not found');
  await audit(req, 'complaint.review.dismiss', 'Complaint', req.params.id, req.user.organization);
  res.json({ ok: true });
}));

// ----- audit log & export -----
router.get('/audit', [query('page').optional().isInt({ min: 1 })], validate, asyncHandler(async (req, res) => {
  const page = Number(req.query.page) || 1;
  const f = { organization: req.user.organization };
  const [items, total] = await Promise.all([AuditLog.find(f).sort({ createdAt: -1 }).skip((page - 1) * 50).limit(50).lean(), AuditLog.countDocuments(f)]);
  res.json({ items, total, page, pages: Math.ceil(total / 50) });
}));

const csvCell = (v) => {
  let s = v == null ? '' : v instanceof Date ? v.toISOString() : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // neutralise spreadsheet formula injection
  return `"${s.replace(/"/g, '""')}"`;
};
router.get('/export/complaints.csv', [query('from').optional().isISO8601(), query('to').optional().isISO8601()], validate, asyncHandler(async (req, res) => {
  const f = { organization: req.user.organization };
  if (req.query.from || req.query.to) f.createdAt = { ...(req.query.from && { $gte: new Date(req.query.from) }), ...(req.query.to && { $lte: new Date(req.query.to) }) };
  const rows = await Complaint.find(f).sort({ createdAt: -1 }).limit(10000).populate('category', 'name').populate('assignedTo', 'name').lean();
  const head = ['Reference', 'Title', 'Category', 'Area', 'Status', 'Priority', 'Assigned to', 'Created', 'Resolved', 'Reopen count'];
  const lines = rows.map((c) => [c.ref, c.title, c.category?.name, c.jurisdictionName, c.status, c.priority?.level, c.assignedTo?.name, c.createdAt, c.resolvedAt, c.reopenCount].map(csvCell).join(','));
  await audit(req, 'report.export', 'Complaint', undefined, req.user.organization, { rows: rows.length });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="complaints.csv"');
  res.send([head.map(csvCell).join(','), ...lines].join('\n'));
}));

export default router;
