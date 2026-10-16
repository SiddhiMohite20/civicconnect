import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import { api, API_ORIGIN, refreshSession } from '../lib/api.js';
import { useAuth } from './AuthContext.jsx';

const Ctx = createContext({ socket: null, connected: false, notifications: [], unread: 0 });
export const useSocket = () => useContext(Ctx);

export function useSocketEvent(event, handler) {
  const { socket } = useSocket();
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!socket) return undefined;
    const fn = (...a) => ref.current(...a);
    socket.on(event, fn);
    return () => socket.off(event, fn);
  }, [socket, event]);
}

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);

  // Persisted notifications are the source of truth; sockets are only a live push channel.
  const fetchNotifications = useCallback(async () => {
    try { const { data } = await api.get('/notifications?limit=50'); setNotifications(data.notifications); setUnread(data.unread); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!user) { setSocket(null); setConnected(false); setNotifications([]); setUnread(0); return undefined; }
    const s = io(API_ORIGIN || undefined, { withCredentials: true, reconnectionDelayMax: 10000 });
    setSocket(s);
    fetchNotifications();
    s.on('connect', () => { setConnected(true); fetchNotifications(); }); // catch up on anything missed while offline
    s.on('disconnect', (reason) => {
      setConnected(false);
      if (reason === 'io server disconnect') refreshSession().then(() => s.connect()).catch(() => {}); // token expired
    });
    s.on('connect_error', (err) => { if (err.message === 'unauthorized') refreshSession().then(() => s.connect()).catch(() => {}); });
    s.on('notification:new', ({ notification }) => {
      setNotifications((p) => [notification, ...p].slice(0, 50));
      setUnread((n) => n + 1);
      toast(notification.title, { icon: '🔔' });
    });
    return () => { s.removeAllListeners(); s.disconnect(); };
  }, [user?._id, fetchNotifications]); // eslint-disable-line react-hooks/exhaustive-deps

  const markAllRead = async () => { await api.post('/notifications/read-all'); setNotifications((p) => p.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() }))); setUnread(0); };
  const markRead = async (id) => {
    await api.patch(`/notifications/${id}/read`);
    setNotifications((p) => p.map((n) => (n._id === id && !n.readAt ? { ...n, readAt: new Date().toISOString() } : n)));
    setUnread((n) => Math.max(0, n - 1));
  };

  return <Ctx.Provider value={{ socket, connected, notifications, unread, markAllRead, markRead, fetchNotifications }}>{children}</Ctx.Provider>;
}
