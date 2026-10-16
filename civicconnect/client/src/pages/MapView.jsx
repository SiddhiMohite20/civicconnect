import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errMsg } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocketEvent } from '../context/SocketContext.jsx';
import { ComplaintMap } from '../components/maps.jsx';
import { Spinner, ErrorBox, Empty, StatusBadge } from '../components/ui.jsx';
import { STATUS, fmt } from '../lib/constants.js';

export default function MapView() {
  const { user } = useAuth();
  const [cats, setCats] = useState([]);
  const [filters, setFilters] = useState({ category: '', status: '' });
  const [markers, setMarkers] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => { api.get(`/meta/categories?organizationId=${user.organization}`).then((r) => setCats(r.data.categories)).catch(() => {}); }, [user.organization]);
  const load = useCallback(async () => {
    try { const { data } = await api.get('/map/public', { params: Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) }); setMarkers(data.markers); setError(null); }
    catch (e) { setError(errMsg(e)); }
  }, [filters]);
  useEffect(() => { setMarkers(null); load(); }, [load]);
  useEffect(() => { const t = setInterval(load, 60000); return () => clearInterval(t); }, [load]); // periodic public refresh
  useSocketEvent('complaint:updated', load);
  useSocketEvent('complaint:created', load);

  const canOpen = (m) => user.role !== 'resident' || m.mine;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-2xl font-bold">Community map</h1><p className="text-sm text-slate-500">Locations are approximate (about 100 m) to protect residents' privacy.</p></div>
        <div className="flex gap-2">
          <select className="input w-auto" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}><option value="">All categories</option>{cats.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select>
          <select className="input w-auto" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">All statuses</option>{Object.entries(STATUS).filter(([k]) => k !== 'rejected').map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
        </div>
      </div>
      {error && <ErrorBox message={error} onRetry={load} />}
      {!markers && !error && <Spinner />}
      {markers && markers.length === 0 && <Empty text="No complaints match these filters." />}
      {markers && markers.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2"><ComplaintMap markers={markers} canOpen={canOpen} /></div>
          <div className="card max-h-[28rem] space-y-2 overflow-y-auto">
            <h2 className="font-semibold">List view ({markers.length})</h2>
            {markers.map((m) => (
              <div key={m.id} className="rounded-lg border border-slate-100 p-2 text-sm">
                <div className="flex items-center justify-between gap-2"><span className="truncate font-medium">{canOpen(m) ? <Link className="text-blue-600 hover:underline" to={`/complaints/${m.id}`}>{m.title}</Link> : m.title}</span><StatusBadge status={m.status} /></div>
                <div className="text-xs text-slate-500">{m.category?.name} · {m.area} · {fmt(m.createdAt)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-3 text-xs text-slate-500">{Object.entries(STATUS).filter(([k]) => k !== 'rejected').map(([k, v]) => <span key={k} className="flex items-center gap-1"><span className="h-3 w-3 rounded-full" style={{ background: v.color }} />{v.label}</span>)}</div>
    </div>
  );
}
