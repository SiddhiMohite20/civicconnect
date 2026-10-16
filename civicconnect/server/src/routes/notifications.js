import { Router } from 'express';
import { Notification } from '../models/Notification.js';
import { authenticate, csrfProtect } from '../middleware/auth.js';
import { asyncHandler, isId, ApiError } from '../utils/http.js';

const router = Router();
router.use(authenticate, csrfProtect);

router.get('/', asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 30, 100);
  const [items, unread] = await Promise.all([
    Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(limit).lean(),
    Notification.countDocuments({ user: req.user._id, readAt: { $exists: false } }),
  ]);
  res.json({ notifications: items, unread });
}));
router.post('/read-all', asyncHandler(async (req, res) => {
  await Notification.updateMany({ user: req.user._id, readAt: { $exists: false } }, { readAt: new Date() });
  res.status(204).end();
}));
router.patch('/:id/read', asyncHandler(async (req, res) => {
  if (!isId(req.params.id)) throw new ApiError(404, 'Not found');
  await Notification.updateOne({ _id: req.params.id, user: req.user._id }, { readAt: new Date() });
  res.status(204).end();
}));
export default router;
