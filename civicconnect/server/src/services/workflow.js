import { config } from '../config.js';

export const OPEN_STATUSES = ['submitted', 'under_review', 'assigned', 'in_progress', 'reopened'];
export const STATUS_LABELS = {
  submitted: 'Submitted', under_review: 'Under review', assigned: 'Assigned', in_progress: 'In progress',
  resolved: 'Resolved', rejected: 'Rejected', reopened: 'Reopened', closed: 'Closed',
};

// Legal transitions: Submitted → Under Review → Assigned → In Progress → Resolved (+ Rejected / Reopened / Closed)
const GRAPH = {
  submitted: ['under_review', 'rejected'],
  under_review: ['assigned', 'rejected'],
  assigned: ['in_progress', 'under_review', 'rejected'],
  in_progress: ['resolved', 'assigned'],
  resolved: ['closed', 'reopened'],
  reopened: ['under_review', 'assigned'],
  rejected: [],
  closed: [],
};
const REASON_REQUIRED = new Set(['rejected', 'reopened']);
const fail = (status, code, message) => ({ ok: false, status, code, message });

export function nextStatuses(from, requireClosure = config.requireClosure) {
  return (GRAPH[from] || []).filter((s) => requireClosure || s !== 'closed');
}

export function checkTransition({
  from, to, role, isOwner = false, note = '', resolvedAt = null, now = new Date(),
  requireClosure = config.requireClosure, reopenWindowDays = config.reopenWindowDays,
}) {
  if (!nextStatuses(from, requireClosure).includes(to)) return fail(409, 'ILLEGAL_TRANSITION', `A complaint cannot move from "${from}" to "${to}"`);
  if (role === 'resident') {
    if (!(isOwner && from === 'resolved' && to === 'reopened')) return fail(403, 'FORBIDDEN_TRANSITION', 'Residents may only reopen their own resolved complaints');
    if (resolvedAt && now - new Date(resolvedAt) > reopenWindowDays * 86400000) return fail(409, 'REOPEN_WINDOW_EXPIRED', `Complaints can only be reopened within ${reopenWindowDays} days of resolution`);
  } else if (role !== 'staff' && role !== 'admin') {
    return fail(403, 'FORBIDDEN_TRANSITION', 'Not allowed');
  }
  if (REASON_REQUIRED.has(to) && String(note).trim().length < 5) return fail(422, 'REASON_REQUIRED', `A reason (at least 5 characters) is required to mark a complaint as ${to}`);
  return { ok: true };
}

export function applyTransition(c, { to, actor, note, now = new Date() }) {
  c.history.push({ from: c.status, to, actor: actor._id, actorName: actor.name, actorRole: actor.role, note: note?.trim() || undefined, at: now });
  c.status = to;
  if (to === 'resolved') c.resolvedAt = now;
  if (to === 'closed') c.closedAt = now;
  if (to === 'reopened') { c.reopenCount += 1; c.resolvedAt = undefined; c.closedAt = undefined; }
}
