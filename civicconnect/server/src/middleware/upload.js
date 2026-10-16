import multer from 'multer';
import { ApiError } from '../utils/http.js';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 3, fields: 20 },
  fileFilter: (_req, file, cb) =>
    ALLOWED.has(file.mimetype) ? cb(null, true) : cb(new ApiError(415, 'Only JPEG, PNG or WebP images are allowed', 'BAD_FILE_TYPE')),
});

// Verify real file signatures (never trust the client-supplied MIME type).
export function detectImage(buf) {
  if (buf.length > 12 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length > 12 && buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') return 'webp';
  return null;
}
export function verifyImages(req, _res, next) {
  for (const f of req.files || []) {
    if (!detectImage(f.buffer)) return next(new ApiError(415, 'File content is not a valid image', 'BAD_FILE_TYPE'));
  }
  next();
}
