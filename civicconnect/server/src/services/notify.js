import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';
import { emitToUser } from '../sockets/emit.js';

// Persist first (so missed notifications survive reconnects), then push over the socket.
export async function notifyUsers(userIds, { type, title, body, complaint }) {
  const ids = [...new Set(userIds.filter(Boolean).map(String))];
  if (!ids.length) return;
  const docs = await Notification.insertMany(ids.map((user) => ({ user, type, title, body, complaint })));
  docs.forEach((d) => emitToUser(d.user, 'notification:new', { notification: d }));
}

export const staffInScope = (c) =>
  User.find({
    isActive: true, organization: c.organization, role: { $in: ['staff', 'admin'] },
    $or: [{ role: 'admin' }, { jurisdictions: { $size: 0 } }, { jurisdictions: c.jurisdiction }],
  }).select('_id');

// Side effects run after the DB write succeeded and must never fail the request.
export const safely = async (fn) => { try { await fn(); } catch (e) { console.error('post-commit side effect failed:', e.message); } };
