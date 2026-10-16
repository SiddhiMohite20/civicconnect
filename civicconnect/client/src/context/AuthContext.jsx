import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, setCsrf, refreshSession } from '../lib/api.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { const { data } = await api.get('/auth/me'); setCsrf(data.csrfToken); setUser(data.user); }
      catch {
        try { const d = await refreshSession(); setUser(d.user); } catch { setUser(null); }
      } finally { setLoading(false); }
    })();
    const onLogout = () => { setUser(null); setCsrf(null); };
    window.addEventListener('cc:logout', onLogout);
    return () => window.removeEventListener('cc:logout', onLogout);
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    setCsrf(data.csrfToken); setUser(data.user); return data.user;
  }, []);
  const register = useCallback(async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    setCsrf(data.csrfToken); setUser(data.user); return data.user;
  }, []);
  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } finally { setUser(null); setCsrf(null); }
  }, []);

  return <Ctx.Provider value={{ user, setUser, loading, login, register, logout }}>{children}</Ctx.Provider>;
}
