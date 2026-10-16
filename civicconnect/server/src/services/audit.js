import { AuditLog } from '../models/AuditLog.js';
export async function audit(req, action, entityType, entityId, organization, meta = {}) {
  try {
    await AuditLog.create({ organization, actor: req.user?._id, actorName: req.user?.name, action, entityType, entityId, meta, ip: req.ip });
  } catch (e) { console.error('audit failed', e.message); }
}
