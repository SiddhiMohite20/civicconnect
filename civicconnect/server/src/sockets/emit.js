import { getIO } from './io.js';

export const emitToUser = (userId, ev, payload) => getIO()?.to(`user:${userId}`).emit(ev, payload);

// Staff rooms: org-wide staff + admins join org:{id}:all; ward-restricted staff join jur:{id}.
export const emitToStaff = (c, ev, payload) =>
  getIO()?.to(`org:${c.organization}:all`).to(`jur:${c.jurisdiction}`).emit(ev, payload);

// Everyone allowed to see this complaint: reporter, joined complaint room, and in-scope staff.
export const emitToComplaintAudience = (c, ev, payload) =>
  getIO()?.to(`complaint:${c._id}`).to(`user:${c.reporter}`).to(`org:${c.organization}:all`).to(`jur:${c.jurisdiction}`).emit(ev, payload);

export const disconnectUser = (userId) => getIO()?.in(`user:${userId}`).disconnectSockets(true);
