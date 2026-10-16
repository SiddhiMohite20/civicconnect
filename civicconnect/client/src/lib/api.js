import axios from 'axios';

export const API_ORIGIN = import.meta.env.VITE_API_URL || '';
export const api = axios.create({ baseURL: `${API_ORIGIN}/api`, withCredentials: true });

// CSRF token is kept in memory only (never localStorage) and echoed back on every state-changing request.
let csrf = null;
export const setCsrf = (t) => { csrf = t; };
api.interceptors.request.use((cfg) => {
  if (csrf && !['get', 'head', 'options'].includes((cfg.method || 'get').toLowerCase())) cfg.headers['X-CSRF-Token'] = csrf;
  return cfg;
});

let refreshing = null;
export const refreshSession = () => {
  refreshing ??= api.post('/auth/refresh').then((r) => { setCsrf(r.data.csrfToken); return r.data; }).finally(() => { refreshing = null; });
  return refreshing;
};

// Transparent single retry after refreshing the short-lived access token.
api.interceptors.response.use((r) => r, async (err) => {
  const { config, response } = err;
  if (response?.status === 401 && config && !config._retry && !config.url.startsWith('/auth/')) {
    config._retry = true;
    try { await refreshSession(); return api(config); }
    catch { window.dispatchEvent(new Event('cc:logout')); }
  }
  throw err;
});

export const errMsg = (e) => e?.response?.data?.message || e?.message || 'Something went wrong';
