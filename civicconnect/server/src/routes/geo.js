import { Router } from 'express';
import { query } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middleware/auth.js';
import { ApiError, asyncHandler, validate } from '../utils/http.js';
import { config } from '../config.js';

// Reverse-geocoding proxy: keeps a valid User-Agent, caches results and serialises calls to ≤1 req/sec
// as required by the public Nominatim usage policy. For heavy use, point NOMINATIM_URL at your own / a paid geocoder.
const router = Router();
const cache = new Map();
let last = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

router.get('/reverse', authenticate, rateLimit({ windowMs: 60000, limit: 20, keyGenerator: (req) => String(req.user._id), validate: false }),
  [query('lat').isFloat({ min: -90, max: 90 }), query('lng').isFloat({ min: -180, max: 180 })], validate,
  asyncHandler(async (req, res) => {
    const lat = Number(req.query.lat), lng = Number(req.query.lng);
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    if (cache.has(key)) return res.json({ address: cache.get(key) });
    const now = Date.now(); const slot = Math.max(now, last + 1100); last = slot;
    if (slot > now) await sleep(slot - now);
    let address = null;
    try {
      const r = await fetch(`${config.nominatimUrl}/reverse?format=jsonv2&lat=${lat}&lon=${lng}`, { headers: { 'User-Agent': config.geocoderUserAgent, 'Accept-Language': 'en' }, signal: AbortSignal.timeout(6000) });
      if (!r.ok) throw new Error(String(r.status));
      address = (await r.json()).display_name || null;
    } catch { throw new ApiError(502, 'Address lookup is currently unavailable', 'GEOCODER_UNAVAILABLE'); }
    if (cache.size > 1000) cache.delete(cache.keys().next().value);
    cache.set(key, address);
    res.json({ address });
  }));
export default router;
