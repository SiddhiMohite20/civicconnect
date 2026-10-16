import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { User } from '../models/User.js';
import { config } from '../config.js';
import { ApiError, asyncHandler } from '../utils/http.js';

export const authenticate = asyncHandler(async (req, _res, next) => {
  const token = req.cookies?.cc_access;
  if (!token) throw new ApiError(401, 'Authentication required', 'UNAUTHENTICATED');
  let payload;
  try { payload = jwt.verify(token, config.jwtAccessSecret, { algorithms: ['HS256'] }); }
  catch { throw new ApiError(401, 'Session expired', 'TOKEN_EXPIRED'); }
  const user = await User.findById(payload.sub);
  if (!user) throw new ApiError(401, 'Authentication required', 'UNAUTHENTICATED');
  if (!user.isActive) throw new ApiError(403, 'Your account has been suspended', 'ACCOUNT_SUSPENDED');
  req.user = user;
  next();
});

export const authorize = (...roles) => (req, _res, next) =>
  roles.includes(req.user?.role) ? next() : next(new ApiError(403, 'You do not have permission to perform this action', 'FORBIDDEN'));

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Defence in depth: reject cross-origin state-changing requests from unknown origins...
export function originCheck(req, _res, next) {
  if (!UNSAFE.has(req.method)) return next();
  const origin = req.get('origin');
  if (origin && !config.clientOrigins.includes(origin)) return next(new ApiError(403, 'Origin not allowed', 'BAD_ORIGIN'));
  next();
}

// ...and require a double-submit CSRF token (cookie value must equal X-CSRF-Token header).
export function csrfProtect(req, _res, next) {
  if (!UNSAFE.has(req.method)) return next();
  const c = req.cookies?.cc_csrf;
  const h = req.get('x-csrf-token');
  const ok = c && h && c.length === h.length && crypto.timingSafeEqual(Buffer.from(c), Buffer.from(h));
  return ok ? next() : next(new ApiError(403, 'Invalid CSRF token', 'BAD_CSRF'));
}
