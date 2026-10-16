import { nextStatuses } from './workflow.js';
import { config } from '../config.js';

export function allowedFor(c, viewer) {
  if (viewer.role === 'resident') {
    const own = String(c.reporter?._id || c.reporter) === String(viewer._id);
    const inWindow = !c.resolvedAt || Date.now() - new Date(c.resolvedAt) <= config.reopenWindowDays * 86400000;
    return own && c.status === 'resolved' && inWindow ? ['reopened'] : [];
  }
  return nextStatuses(c.status).filter((s) => s !== 'assigned'); // "assigned" is set via the assign action
}

export function serializeComplaint(doc, viewer) {
  const o = doc.toObject ? doc.toObject() : { ...doc };
  const out = { ...o, id: o._id, allowedTransitions: allowedFor(o, viewer) };
  delete out.idempotencyKey; delete out.__v;
  if (viewer.role === 'resident') {
    delete out.reporter; delete out.duplicateSuspectOf; delete out.flag; delete out.isHidden;
    out.assignedTo = o.assignedTo ? { name: o.assignedTo.name } : null;
    out.history = (o.history || []).map((h) => ({ from: h.from, to: h.to, note: h.note, at: h.at, actorRole: h.actorRole === 'resident' ? 'resident' : 'staff' }));
    delete out.priority.by;
    if (out.resolution) delete out.resolution.by;
  }
  return out;
}
