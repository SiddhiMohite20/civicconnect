import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { config } from '../config.js';
import { User } from '../models/User.js';

export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const base = () => ({ httpOnly: true, secure: config.cookie.secure, sameSite: config.cookie.sameSite, domain: config.cookie.domain });

export async function issueSession(res, user, oldHash) {
  const access = jwt.sign({ sub: String(user._id), role: user.role }, config.jwtAccessSecret, { algorithm: 'HS256', expiresIn: `${config.accessTtlMin}m` });
  const refresh = crypto.randomBytes(48).toString('hex');
  const csrf = crypto.randomBytes(24).toString('hex');
  const refreshMs = config.refreshTtlDays * 86400000;
  if (oldHash) await User.updateOne({ _id: user._id }, { $pull: { refreshTokens: { hash: oldHash } } });
  await User.updateOne({ _id: user._id }, { $push: { refreshTokens: { $each: [{ hash: sha256(refresh), expires: new Date(Date.now() + refreshMs) }], $slice: -5 } } });
  res.cookie('cc_access', access, { ...base(), maxAge: config.accessTtlMin * 60000, path: '/' });
  res.cookie('cc_refresh', refresh, { ...base(), maxAge: refreshMs, path: '/api/auth' });
  res.cookie('cc_csrf', csrf, { ...base(), maxAge: refreshMs, path: '/' });
  return csrf;
}
export function clearSession(res) {
  res.clearCookie('cc_access', { ...base(), path: '/' });
  res.clearCookie('cc_refresh', { ...base(), path: '/api/auth' });
  res.clearCookie('cc_csrf', { ...base(), path: '/' });
}
