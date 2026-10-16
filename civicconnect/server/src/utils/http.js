import mongoose from 'mongoose';
import { validationResult } from 'express-validator';

export class ApiError extends Error {
  constructor(status, message, code = 'ERROR', extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
export const validate = (req, _res, next) => {
  const r = validationResult(req);
  if (r.isEmpty()) return next();
  next(new ApiError(422, 'Validation failed', 'VALIDATION', { errors: r.array().map((e) => ({ field: e.path, message: e.msg })) }));
};
export const isId = (v) => typeof v === 'string' && mongoose.isValidObjectId(v);
export const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const roundCoord = (n, d = 3) => Math.round(n * 10 ** d) / 10 ** d;

// Strip Mongo operator keys ($...) and dotted keys from user input (NoSQL injection defence).
export function sanitize(req, _res, next) {
  const clean = (o) => {
    if (!o || typeof o !== 'object') return;
    for (const k of Object.keys(o)) {
      if (k.startsWith('$') || k.includes('.')) delete o[k];
      else clean(o[k]);
    }
  };
  clean(req.body);
  clean(req.query);
  clean(req.params);
  next();
}

export function errorHandler(err, _req, res, _next) {
  if (err instanceof ApiError) return res.status(err.status).json({ message: err.message, code: err.code, ...err.extra });
  if (err?.name === 'MulterError') {
    const big = err.code === 'LIMIT_FILE_SIZE';
    return res.status(big ? 413 : 400).json({ message: big ? 'Image is too large (max 5 MB)' : err.message, code: 'UPLOAD_ERROR' });
  }
  if (err?.name === 'CastError') return res.status(400).json({ message: 'Invalid identifier', code: 'BAD_ID' });
  if (err?.code === 11000) return res.status(409).json({ message: 'Duplicate value', code: 'DUPLICATE' });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ message: 'Malformed JSON', code: 'BAD_JSON' });
  console.error(err);
  res.status(500).json({ message: 'Internal server error', code: 'INTERNAL' });
}
