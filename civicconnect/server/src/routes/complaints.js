import { Router } from 'express';
import { body, query } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { Complaint, PRIORITIES, STATUSES } from '../models/Complaint.js';
import { Organization } from '../models/Organization.js';
import { Category } from '../models/Category.js';
import { Comment } from '../models/Comment.js';
import { User } from '../models/User.js';
import { authenticate, authorize, csrfProtect } from '../middleware/auth.js';
import { upload, verifyImages } from '../middleware/upload.js';
import { ApiError, asyncHandler, validate, isId, escapeRegex } from '../utils/http.js';
import { checkTransition, applyTransition, OPEN_STATUSES, STATUS_LABELS } from '../services/workflow.js';
import { scopeFilter, canView, covers, isStaffLike } from '../services/scope.js';
import { serializeComplaint } from '../services/serialize.js';
import { uploadImage } from '../services/uploads.js';
import { notifyUsers, staffInScope, safely } from '../services/notify.js';
import { emitToStaff, emitToComplaintAudience, emitToUser } from '../sockets/emit.js';
import { audit } from '../services/audit.js';
import { config } from '../config.js';
import stats from './stats.js';

const router = Router();
router.use(authenticate, csrfProtect);
router.use('/stats', stats);

const POPULATE = [{ path: 'category', select: 'name color' }, { path: 'assignedTo', select: 'name' }, { path: 'reporter', select: 'name email phone' }];
const populated = (id) => Complaint.findById(id).populate(POPULATE);
const createLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, keyGenerator: (req) => String(req.user._id), validate: false, message: { message: 'You are submitting too many reports. Please try again later.', code: 'RATE_LIMITED' } });
const staffOnly = authorize('staff', 'admin');

async function load(req) {
  if (!isId(req.params.id)) throw new ApiError(404, 'Complaint not found', 'NOT_FOUND');
  const c = await Complaint.findById(req.params.id);
  if (!c || !canView(req.user, c)) throw new ApiError(404, 'Complaint not found', 'NOT_FOUND'); // 404 (not 403) avoids leaking existence
  return c;
}
const respond = async (res, id, viewer, status = 200, extra = {}) => res.status(status).json({ complaint: serializeComplaint(await populated(id), viewer), ...extra });

function broadcast(c, reason, extra = {}) {
  const payload = { id: String(c._id), ref: c.ref, status: c.status, priority: c.priority?.level, updatedAt: c.updatedAt, reason, ...extra };
  emitToComplaintAudience(c, 'complaint:updated', payload);
  emitToStaff(c, 'dashboard:statsUpdated', {});
}

// ---------- create ----------
router.post('/', authorize('resident'), createLimiter, upload.array('images', 3), verifyImages, [
  body('title').isString().trim().isLength({ min: 5, max: 120 }),
  body('description').isString().trim().isLength({ min: 10, max: 2000 }),
  body('categoryId').custom(isId), body('jurisdictionId').custom(isId),
  body('latitude').isFloat({ min: -90, max: 90 }), body('longitude').isFloat({ min: -180, max: 180 }),
  body('address').optional({ values: 'falsy' }).isString().trim().isLength({ max: 300 }),
  body('landmark').optional({ values: 'falsy' }).isString().trim().isLength({ max: 150 }),
], validate, asyncHandler(async (req, res) => {
  const b = req.body;
  const key = req.get('Idempotency-Key');
  if (key) {
    if (key.length > 100) throw new ApiError(400, 'Invalid idempotency key');
    const existing = await Complaint.findOne({ reporter: req.user._id, idempotencyKey: key }).select('_id');
    if (existing) return respond(res, existing._id, req.user, 200, { duplicateRequest: true });
  }
  const org = await Organization.findOne({ _id: req.user.organization, isActive: true });
  const ward = org?.jurisdictions.id(b.jurisdictionId);
  if (!ward?.isActive) throw new ApiError(422, 'Invalid area selected', 'VALIDATION');
  const cat = await Category.findOne({ _id: b.categoryId, organization: org._id, isActive: true });
  if (!cat) throw new ApiError(422, 'Invalid category selected', 'VALIDATION');

  const lng = Number(b.longitude), lat = Number(b.latitude);
  const nearby = await Complaint.find({
    organization: org._id, category: cat._id, isHidden: { $ne: true }, status: { $in: OPEN_STATUSES },
    createdAt: { $gte: new Date(Date.now() - 14 * 86400000) },
    location: { $nearSphere: { $geometry: { type: 'Point', coordinates: [lng, lat] }, $maxDistance: config.duplicateRadiusM } },
  }).select('ref title status createdAt').limit(3);
  let suspect;
  if (nearby.length) {
    if (b.confirmNotDuplicate !== 'true') {
      throw new ApiError(409, 'Similar open reports already exist near this location', 'POSSIBLE_DUPLICATE', { duplicates: nearby.map((d) => ({ ref: d.ref, title: d.title, status: d.status, createdAt: d.createdAt })) });
    }
    suspect = nearby[0]._id; // flagged for admin review
  }

  const images = await Promise.all((req.files || []).map((f) => uploadImage(f.buffer, 'complaints')));
  let c;
  try {
    c = await Complaint.create({
      title: b.title, description: b.description, category: cat._id, organization: org._id,
      jurisdiction: ward._id, jurisdictionName: ward.name, reporter: req.user._id,
      location: { type: 'Point', coordinates: [lng, lat] }, address: b.address, landmark: b.landmark, images,
      idempotencyKey: key || undefined, duplicateSuspectOf: suspect,
      history: [{ from: null, to: 'submitted', actor: req.user._id, actorName: req.user.name, actorRole: 'resident', note: 'Complaint submitted' }],
    });
  } catch (e) {
    if (e.code === 11000 && key) { // double-click race: same idempotency key
      const ex = await Complaint.findOne({ reporter: req.user._id, idempotencyKey: key }).select('_id');
      if (ex) return respond(res, ex._id, req.user, 200, { duplicateRequest: true });
    }
    throw e;
  }
  await safely(async () => {
    const staff = await staffInScope(c);
    await notifyUsers(staff.map((s) => s._id), { type: 'complaint_created', title: `New complaint ${c.ref}`, body: c.title, complaint: c._id });
    emitToStaff(c, 'complaint:created', { id: String(c._id), ref: c.ref, title: c.title, category: cat.name, area: c.jurisdictionName, createdAt: c.createdAt });
    emitToStaff(c, 'dashboard:statsUpdated', {});
  });
  await respond(res, c._id, req.user, 201);
}));

// ---------- lists ----------
router.get('/mine', authorize('resident'), asyncHandler(async (req, res) => {
  const items = await Complaint.find({ reporter: req.user._id }).sort({ createdAt: -1 }).limit(100)
    .select('ref title status category createdAt images jurisdictionName').populate('category', 'name color').lean();
  res.json({ complaints: items });
}));

router.get('/', staffOnly, [
  query('status').optional().isIn(STATUSES), query('priority').optional().isIn(PRIORITIES),
  query('category').optional().custom(isId), query('jurisdiction').optional().custom(isId),
  query('assignedTo').optional().custom((v) => v === 'me' || v === 'none' || isId(v)),
  query('from').optional().isISO8601(), query('to').optional().isISO8601(),
  query('q').optional().isString().isLength({ max: 80 }),
  query('lat').optional().isFloat({ min: -90, max: 90 }), query('lng').optional().isFloat({ min: -180, max: 180 }),
  query('radiusKm').optional().isFloat({ min: 0.1, max: 50 }),
  query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1, max: 100 }),
], validate, asyncHandler(async (req, res) => {
  const q = req.query;
  const f = scopeFilter(req.user); // organisation + ward restrictions enforced here, never from client input
  if (q.status) f.status = q.status;
  if (q.priority) f['priority.level'] = q.priority;
  if (q.category) f.category = q.category;
  if (q.jurisdiction) {
    if (!covers(req.user, q.jurisdiction)) return res.json({ items: [], total: 0, page: 1, pages: 0 });
    f.jurisdiction = req.user.role === 'staff' && req.user.jurisdictions?.length ? { $in: req.user.jurisdictions.filter((j) => String(j) === q.jurisdiction) } : q.jurisdiction;
  }
  if (q.assignedTo === 'me') f.assignedTo = req.user._id; else if (q.assignedTo === 'none') f.assignedTo = null; else if (q.assignedTo) f.assignedTo = q.assignedTo;
  if (q.from || q.to) f.createdAt = { ...(q.from && { $gte: new Date(q.from) }), ...(q.to && { $lte: new Date(q.to) }) };
  if (q.q) { const rx = new RegExp(escapeRegex(q.q.trim()), 'i'); f.$or = [{ title: rx }, { ref: rx }]; }
  if (q.lat && q.lng) f.location = { $geoWithin: { $centerSphere: [[Number(q.lng), Number(q.lat)], Number(q.radiusKm || 2) / 6378.1] } };
  const page = Number(q.page) || 1, limit = Number(q.limit) || 20;
  const [items, total] = await Promise.all([
    Complaint.find(f).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)
      .select('ref title status priority category assignedTo createdAt jurisdictionName location images')
      .populate('category', 'name color').populate('assignedTo', 'name').lean(),
    Complaint.countDocuments(f),
  ]);
  res.json({ items, total, page, pages: Math.ceil(total / limit) });
}));

// ---------- detail ----------
router.get('/:id', asyncHandler(async (req, res) => {
  const c = await load(req);
  await respond(res, c._id, req.user);
}));

router.get('/:id/assignees', staffOnly, asyncHandler(async (req, res) => {
  const c = await load(req);
  const users = await User.find({ isActive: true, organization: c.organization, role: { $in: ['staff', 'admin'] } }).select('name role jurisdictions').lean();
  res.json({ assignees: users.filter((u) => covers(u, c.jurisdiction)).map((u) => ({ _id: u._id, name: u.name, role: u.role })) });
}));

// ---------- workflow ----------
async function moveStatus(req, c, to, note) {
  const from = c.status;
  const chk = checkTransition({ from, to, role: req.user.role, isOwner: String(c.reporter) === String(req.user._id), note, resolvedAt: c.resolvedAt });
  if (!chk.ok) throw new ApiError(chk.status, chk.message, chk.code);
  applyTransition(c, { to, actor: req.user, note });
  await c.save();
  await audit(req, 'complaint.status', 'Complaint', c._id, c.organization, { from, to });
  await safely(async () => {
    const at = new Date();
    emitToComplaintAudience(c, 'complaint:statusChanged', { id: String(c._id), ref: c.ref, from, to, at });
    broadcast(c, 'status');
    const label = STATUS_LABELS[to];
    if (String(c.reporter) !== String(req.user._id)) {
      await notifyUsers([c.reporter], { type: 'status_changed', title: `Complaint ${c.ref} is now ${label}`, body: note?.slice(0, 200) || c.title, complaint: c._id });
    }
    if (to === 'reopened') {
      const staff = await staffInScope(c);
      await notifyUsers([...staff.map((s) => s._id), c.assignedTo], { type: 'complaint_reopened', title: `Complaint ${c.ref} was reopened`, body: note?.slice(0, 200), complaint: c._id });
    }
  });
}

router.post('/:id/status', staffOnly, upload.array('images', 3), verifyImages, [
  body('status').isIn(STATUSES), body('note').optional({ values: 'falsy' }).isString().trim().isLength({ max: 1000 }),
], validate, asyncHandler(async (req, res) => {
  const c = await load(req);
  const to = req.body.status, note = req.body.note || '';
  if (to === 'assigned') throw new ApiError(409, 'Use the assign action to assign a complaint', 'USE_ASSIGN');
  if (to === 'in_progress' && !c.assignedTo) throw new ApiError(409, 'Assign the complaint before starting work', 'NOT_ASSIGNED');
  if (to === 'resolved') {
    if (note.trim().length < 5) throw new ApiError(422, 'A resolution note is required', 'REASON_REQUIRED');
    const chk = checkTransition({ from: c.status, to, role: req.user.role, note });
    if (!chk.ok) throw new ApiError(chk.status, chk.message, chk.code);
    const imgs = await Promise.all((req.files || []).map((f) => uploadImage(f.buffer, 'resolutions')));
    c.resolution = { note: note.trim(), images: imgs, by: req.user._id, at: new Date() };
  }
  await moveStatus(req, c, to, note);
  await respond(res, c._id, req.user);
}));

router.post('/:id/reopen', authorize('resident'), [body('reason').isString().trim().isLength({ min: 5, max: 1000 })], validate,
  asyncHandler(async (req, res) => {
    const c = await load(req);
    await moveStatus(req, c, 'reopened', req.body.reason);
    await respond(res, c._id, req.user);
  }));

router.post('/:id/assign', staffOnly, [body('assigneeId').custom(isId), body('note').optional({ values: 'falsy' }).isString().isLength({ max: 500 })], validate,
  asyncHandler(async (req, res) => {
    const c = await load(req);
    if (['submitted'].includes(c.status)) throw new ApiError(409, 'Move the complaint to "Under review" before assigning it', 'ILLEGAL_TRANSITION');
    if (['resolved', 'closed', 'rejected'].includes(c.status)) throw new ApiError(409, 'This complaint can no longer be assigned', 'ILLEGAL_TRANSITION');
    const assignee = await User.findOne({ _id: req.body.assigneeId, isActive: true, organization: c.organization, role: { $in: ['staff', 'admin'] } });
    if (!assignee || !covers(assignee, c.jurisdiction)) throw new ApiError(422, 'That staff member cannot be assigned to this complaint', 'VALIDATION');
    c.assignedTo = assignee._id;
    if (['under_review', 'reopened'].includes(c.status)) {
      const chk = checkTransition({ from: c.status, to: 'assigned', role: req.user.role });
      if (!chk.ok) throw new ApiError(chk.status, chk.message, chk.code);
      applyTransition(c, { to: 'assigned', actor: req.user, note: `Assigned to ${assignee.name}` });
    } else {
      c.history.push({ from: c.status, to: c.status, actor: req.user._id, actorName: req.user.name, actorRole: req.user.role, note: `Reassigned to ${assignee.name}`, at: new Date() });
    }
    await c.save();
    await audit(req, 'complaint.assign', 'Complaint', c._id, c.organization, { assignee: assignee._id });
    await safely(async () => {
      emitToUser(assignee._id, 'complaint:assigned', { id: String(c._id), ref: c.ref, title: c.title });
      emitToStaff(c, 'complaint:assigned', { id: String(c._id), ref: c.ref, assigneeId: String(assignee._id) });
      emitToComplaintAudience(c, 'complaint:statusChanged', { id: String(c._id), ref: c.ref, to: c.status, at: new Date() });
      broadcast(c, 'assigned');
      await notifyUsers([assignee._id], { type: 'complaint_assigned', title: `Complaint ${c.ref} assigned to you`, body: c.title, complaint: c._id });
      if (String(c.reporter) !== String(req.user._id)) await notifyUsers([c.reporter], { type: 'status_changed', title: `Complaint ${c.ref} has been assigned`, body: 'A staff member is now responsible for your report.', complaint: c._id });
    });
    await respond(res, c._id, req.user);
  }));

router.post('/:id/priority', staffOnly, [body('level').isIn(PRIORITIES), body('reason').isString().trim().isLength({ min: 3, max: 200 })], validate,
  asyncHandler(async (req, res) => {
    const c = await load(req);
    c.priority = { level: req.body.level, reason: req.body.reason, by: req.user._id, at: new Date() };
    await c.save();
    await audit(req, 'complaint.priority', 'Complaint', c._id, c.organization, { level: req.body.level });
    await safely(async () => broadcast(c, 'priority'));
    await respond(res, c._id, req.user);
  }));

// ---------- comments / notes ----------
const shape = (cm, viewer) => ({
  id: cm._id, text: cm.text, visibility: cm.visibility, at: cm.createdAt, authorRole: cm.authorRole,
  authorName: viewer.role === 'resident' && cm.authorRole !== 'resident' ? 'Municipal staff' : cm.author?.name,
  mine: String(cm.author?._id || cm.author) === String(viewer._id),
});

router.get('/:id/comments', asyncHandler(async (req, res) => {
  const c = await load(req);
  const f = { complaint: c._id };
  if (!isStaffLike(req.user)) f.visibility = 'public'; // residents never see internal notes
  const items = await Comment.find(f).sort({ createdAt: 1 }).populate('author', 'name').lean();
  res.json({ comments: items.map((x) => shape(x, req.user)) });
}));

router.post('/:id/comments', [body('text').isString().trim().isLength({ min: 1, max: 2000 }), body('visibility').optional().isIn(['public', 'internal'])], validate,
  asyncHandler(async (req, res) => {
    const c = await load(req);
    if (c.status === 'closed') throw new ApiError(409, 'This complaint is closed', 'CLOSED');
    const visibility = isStaffLike(req.user) ? req.body.visibility || 'public' : 'public';
    const cm = await Comment.create({ complaint: c._id, author: req.user._id, authorRole: req.user.role, text: req.body.text, visibility });
    await safely(async () => {
      if (visibility === 'internal') { // staff rooms only — the reporter is never notified
        emitToStaff(c, 'complaint:updated', { id: String(c._id), ref: c.ref, reason: 'internal_note' });
        return;
      }
      broadcast(c, 'comment');
      if (isStaffLike(req.user)) await notifyUsers([c.reporter], { type: 'progress_update', title: `Update on ${c.ref}`, body: req.body.text.slice(0, 200), complaint: c._id });
      else await notifyUsers([c.assignedTo], { type: 'resident_comment', title: `New comment on ${c.ref}`, body: req.body.text.slice(0, 200), complaint: c._id });
    });
    res.status(201).json({ comment: shape(await cm.populate('author', 'name'), req.user) });
  }));

export default router;
