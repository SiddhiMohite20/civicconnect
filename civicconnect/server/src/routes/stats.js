import { Router } from 'express';
import { Complaint } from '../models/Complaint.js';
import { authorize } from '../middleware/auth.js';
import { asyncHandler } from '../utils/http.js';
import { scopeFilter } from '../services/scope.js';

const router = Router();
router.get('/', authorize('staff', 'admin'), asyncHandler(async (req, res) => {
  const match = scopeFilter(req.user);
  const since = new Date(Date.now() - 30 * 86400000);
  const [byStatus, byCategory, byDay, res1] = await Promise.all([
    Complaint.aggregate([{ $match: match }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    Complaint.aggregate([{ $match: match }, { $group: { _id: '$category', n: { $sum: 1 } } },
      { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'c' } },
      { $project: { _id: 0, name: { $ifNull: [{ $arrayElemAt: ['$c.name', 0] }, 'Unknown'] }, n: 1 } }, { $sort: { n: -1 } }]),
    Complaint.aggregate([{ $match: { ...match, createdAt: { $gte: since } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, n: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    Complaint.aggregate([{ $match: { ...match, resolvedAt: { $exists: true } } }, { $group: { _id: null, avg: { $avg: { $subtract: ['$resolvedAt', '$createdAt'] } } } }]),
  ]);
  const s = Object.fromEntries(byStatus.map((x) => [x._id, x.n]));
  const total = byStatus.reduce((a, x) => a + x.n, 0);
  res.json({
    total, byStatus: s,
    open: ['submitted', 'under_review', 'assigned', 'in_progress', 'reopened'].reduce((a, k) => a + (s[k] || 0), 0),
    byCategory, byDay: byDay.map((d) => ({ date: d._id, count: d.n })),
    avgResolutionHours: res1[0] ? Math.round((res1[0].avg / 3600000) * 10) / 10 : null,
  });
}));
export default router;
