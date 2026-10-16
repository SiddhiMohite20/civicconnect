import { Router } from 'express';
import { body } from 'express-validator';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { User } from '../models/User.js';
import { Organization } from '../models/Organization.js';
import { authenticate, csrfProtect } from '../middleware/auth.js';
import { ApiError, asyncHandler, validate, isId } from '../utils/http.js';
import { issueSession, clearSession, sha256 } from '../services/session.js';
import { config } from '../config.js';

const router = Router();
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);
const limiter = (limit) => rateLimit({ windowMs: 15 * 60 * 1000, limit, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many attempts, please try again later', code: 'RATE_LIMITED' } });
const password = (f = 'password') => body(f).isString().isLength({ min: 8, max: 128 }).matches(/[A-Za-z]/).matches(/\d/).withMessage('Password must be at least 8 characters and include letters and numbers');

router.post('/register', limiter(20), [
  body('name').isString().trim().isLength({ min: 2, max: 80 }),
  body('email').isEmail().trim(),
  body('phone').optional({ values: 'falsy' }).isString().trim().isLength({ max: 20 }),
  password(),
  body('organizationId').custom(isId), body('jurisdictionId').custom(isId),
], validate, asyncHandler(async (req, res) => {
  const { name, email, phone, password: pw, organizationId, jurisdictionId } = req.body;
  const org = await Organization.findOne({ _id: organizationId, isActive: true });
  const ward = org?.jurisdictions.id(jurisdictionId);
  if (!org || !ward?.isActive) throw new ApiError(422, 'Please choose a valid organization and area', 'VALIDATION');
  if (await User.exists({ email: email.toLowerCase() })) throw new ApiError(409, 'An account with this email already exists', 'EMAIL_TAKEN');
  const user = await User.create({ name, email, phone, passwordHash: await bcrypt.hash(pw, 12), role: 'resident', organization: org._id, jurisdiction: ward._id });
  const csrfToken = await issueSession(res, user);
  res.status(201).json({ user, csrfToken });
}));

router.post('/login', limiter(10), [body('email').isEmail(), body('password').isString().isLength({ min: 1, max: 128 })], validate,
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ email: req.body.email.toLowerCase() }).select('+passwordHash');
    const ok = await bcrypt.compare(req.body.password, user?.passwordHash || DUMMY_HASH); // constant-ish time
    if (!user || !ok) throw new ApiError(401, 'Invalid email or password', 'BAD_CREDENTIALS');
    if (!user.isActive) throw new ApiError(403, 'Your account has been suspended', 'ACCOUNT_SUSPENDED');
    const csrfToken = await issueSession(res, user);
    res.json({ user, csrfToken });
  }));

router.post('/refresh', limiter(60), asyncHandler(async (req, res) => {
  const raw = req.cookies?.cc_refresh;
  if (!raw) throw new ApiError(401, 'Not signed in', 'UNAUTHENTICATED');
  const hash = sha256(raw);
  const user = await User.findOne({ refreshTokens: { $elemMatch: { hash, expires: { $gt: new Date() } } } });
  if (!user) { clearSession(res); throw new ApiError(401, 'Session expired', 'UNAUTHENTICATED'); }
  if (!user.isActive) { clearSession(res); throw new ApiError(403, 'Your account has been suspended', 'ACCOUNT_SUSPENDED'); }
  const csrfToken = await issueSession(res, user, hash); // rotation: old refresh token is invalidated
  res.json({ user, csrfToken });
}));

router.post('/logout', asyncHandler(async (req, res) => {
  const raw = req.cookies?.cc_refresh;
  if (raw) await User.updateOne({ refreshTokens: { $elemMatch: { hash: sha256(raw) } } }, { $pull: { refreshTokens: { hash: sha256(raw) } } });
  clearSession(res);
  res.status(204).end();
}));

router.get('/me', authenticate, asyncHandler(async (req, res) => {
  let csrf = req.cookies?.cc_csrf;
  if (!csrf) {
    csrf = crypto.randomBytes(24).toString('hex');
    res.cookie('cc_csrf', csrf, { httpOnly: true, secure: config.cookie.secure, sameSite: config.cookie.sameSite, domain: config.cookie.domain, maxAge: config.refreshTtlDays * 86400000, path: '/' });
  }
  res.json({ user: req.user, csrfToken: csrf });
}));

router.patch('/profile', authenticate, csrfProtect, [
  body('name').optional().isString().trim().isLength({ min: 2, max: 80 }),
  body('phone').optional({ values: 'falsy' }).isString().trim().isLength({ max: 20 }),
  body('currentPassword').optional().isString(),
  password('newPassword').optional(),
], validate, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+passwordHash');
  if (req.body.name) user.name = req.body.name;
  if (req.body.phone !== undefined) user.phone = req.body.phone;
  if (req.body.newPassword) {
    if (!(await bcrypt.compare(req.body.currentPassword || '', user.passwordHash))) throw new ApiError(401, 'Current password is incorrect', 'BAD_CREDENTIALS');
    user.passwordHash = await bcrypt.hash(req.body.newPassword, 12);
    user.refreshTokens = []; // sign out other devices
  }
  await user.save();
  res.json({ user });
}));

export default router;
