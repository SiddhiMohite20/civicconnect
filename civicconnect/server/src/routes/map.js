import { Router } from 'express';
import { query } from 'express-validator';
import { Complaint, STATUSES } from '../models/Complaint.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler, validate, isId, roundCoord } from '../utils/http.js';

const router = Router();
// Public (organization-wide) map data. Privacy: coordinates rounded to ~100 m; no reporter identity, contact info,
// description, address or photos are ever returned here.
router.get('/public', authenticate, [query('category').optional().custom(isId), query('status').optional().isIn(STATUSES)], validate,
  asyncHandler(async (req, res) => {
    if (req.query.status === 'rejected') return res.json({ markers: [] });
    const f = { organization: req.user.organization, isHidden: { $ne: true }, status: { $ne: 'rejected' } };
    if (req.query.category) f.category = req.query.category;
    if (req.query.status) f.status = req.query.status;
    const items = await Complaint.find(f).select('ref title category status location createdAt reporter jurisdictionName')
      .populate('category', 'name color').sort({ createdAt: -1 }).limit(500).lean();
    res.json({
      markers: items.map((c) => ({
        id: c._id, ref: c.ref, title: c.title, category: c.category, status: c.status, area: c.jurisdictionName, createdAt: c.createdAt,
        lat: roundCoord(c.location.coordinates[1]), lng: roundCoord(c.location.coordinates[0]),
        mine: String(c.reporter) === String(req.user._id),
      })),
    });
  }));
export default router;
