import { Server } from 'socket.io';
import cookie from 'cookie';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { User } from '../models/User.js';
import { Complaint } from '../models/Complaint.js';
import { canView } from '../services/scope.js';
import { isId } from '../utils/http.js';
import { setIO } from './io.js';

export function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: config.clientOrigins, credentials: true },
    // Block cross-site WebSocket hijacking: only our own front-end origins may connect.
    allowRequest: (req, cb) => {
      const o = req.headers.origin;
      cb(null, !o || config.clientOrigins.includes(o));
    },
  });
  setIO(io);

  // Authenticate every connection from the HttpOnly access-token cookie.
  io.use(async (socket, next) => {
    try {
      const token = cookie.parse(socket.handshake.headers.cookie || '').cc_access;
      if (!token) return next(new Error('unauthorized'));
      const payload = jwt.verify(token, config.jwtAccessSecret, { algorithms: ['HS256'] });
      const user = await User.findById(payload.sub);
      if (!user || !user.isActive) return next(new Error('unauthorized'));
      socket.data.user = user;
      socket.data.exp = payload.exp * 1000;
      next();
    } catch { next(new Error('unauthorized')); }
  });

  io.on('connection', (socket) => {
    const u = socket.data.user;
    socket.join(`user:${u._id}`);
    if (u.role === 'admin') socket.join(`org:${u.organization}:all`);
    if (u.role === 'staff') {
      if (u.jurisdictions?.length) u.jurisdictions.forEach((j) => socket.join(`jur:${j}`));
      else socket.join(`org:${u.organization}:all`);
    }
    // When the access token expires the client is dropped and reconnects after refreshing its session.
    const timer = setTimeout(() => socket.disconnect(true), Math.max(1000, socket.data.exp - Date.now()));
    socket.on('disconnect', () => clearTimeout(timer));

    socket.on('complaint:join', async (id, ack) => {
      try {
        if (!isId(id)) return ack?.({ ok: false });
        const c = await Complaint.findById(id).select('reporter organization jurisdiction');
        if (!c || !canView(u, c)) return ack?.({ ok: false }); // authorization check before joining the room
        socket.join(`complaint:${id}`);
        ack?.({ ok: true });
      } catch { ack?.({ ok: false }); }
    });
    socket.on('complaint:leave', (id) => { if (isId(id)) socket.leave(`complaint:${id}`); });
  });
  return io;
}
