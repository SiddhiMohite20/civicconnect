import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts';
import { Activity, CheckCircle2, Inbox, Timer, Wrench } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, errMsg } from '../lib/api.js';
import { useSocketEvent } from '../context/SocketContext.jsx';
import { Spinner, ErrorBox, Empty, StatusBadge, PriorityBadge } from '../components/ui.jsx';
import { STATUS, PRIORITIES, fmt } from '../lib/constants.js';

const AXIS = { tick: { fill: '#8fa3c7', fontSize: 11 }, axisLine: { stroke: '#1b2a47' }, tickLine: { stroke: '#1b2a47' } };
const GRID = '#1b2a47';
const TIP = {
  contentStyle: { background: '#0f1a30', border: '1px solid #2b3d61', borderRadius: 12, color: '#e0e7f4' },
  cursor: { fill: 'rgba(34,211,238,.08)' },
};

const Stat = ({ label, value, icon: Icon, accent }) => (
  <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-ink-800 to-ink-900 p-4 shadow-lg shadow-black/20">
    <div className="absolute inset-y-0 left-0 w-1" style={{ background: accent }} />
    <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-20 blur-2xl" style={{ background: accent }} />
    <div className="flex items-center justify-between">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      <Icon className="h-4 w-4" style={{ color: accent }} />
    </div>
    <div className="mt-2 font-display text-3xl font-extrabold tracking-tight text-slate-900">{value ?? '—'}</div>
  </div>
);

const initial = { status: '', category: '', priority: '', jurisdiction: '', assignedTo: '', q: '', from: '', to: '' };

export default function StaffDashboard() {
  const [stats, setStats] = useState(null);
  const [list, setList] = useState(null);
  const [filters, setFilters] = useState(initial);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ cats: [], wards: [] });
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/auth/me').then(async ({ data }) => {
      const [c, o] = await Promise.all([
        api.get(`/meta/categories?organizationId=${data.user.organization}`),
        api.get('/meta/organizations'),
      ]);
      setMeta({
        cats: c.data.categories,
        wards: o.data.organizations.find((x) => x._id === data.user.organization)?.jurisdictions || [],
      });
    }).catch(() => {});
  }, []);

  const loadStats = useCallback(() => api.get('/complaints/stats').then((r) => setStats(r.data)).catch((e) => setError(errMsg(e))), []);
  const loadList = useCallback(async () => {
    try {
      const params = { page, limit: 15, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) };
      if (params.from) params.from = new Date(params.from).toISOString();
      if (params.to) params.to = new Date(`${params.to}T23:59:59`).toISOString();
      const { data } = await api.get('/complaints', { params });
      setList(data); setError(null);
    } catch (e) { setError(errMsg(e)); }
  }, [filters, page]);
  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadList(); }, [loadList]);

  useSocketEvent('dashboard:statsUpdated', () => { loadStats(); loadList(); }); // live counters
  useSocketEvent('complaint:created', (c) => toast(`New: ${c.title} (${c.area})`, { icon: '🆕' }));
  useSocketEvent('complaint:assigned', (c) => toast(`Complaint ${c.ref} assigned`, { icon: '📌' }));

  const set = (k) => (e) => { setPage(1); setFilters({ ...filters, [k]: e.target.value }); };
  const statusData = stats ? Object.entries(stats.byStatus).map(([k, n]) => ({ name: STATUS[k]?.label || k, n, color: STATUS[k]?.color })) : [];

  if (error && !stats) return <ErrorBox message={error} onRetry={() => { loadStats(); loadList(); }} />;
  if (!stats) return <Spinner />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold">Operations dashboard</h1>
        <p className="text-sm text-slate-500">Live overview of complaints in your jurisdiction</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Total" value={stats.total} icon={Inbox} accent="#22d3ee" />
        <Stat label="Open" value={stats.open} icon={Activity} accent="#a78bfa" />
        <Stat label="In progress" value={stats.byStatus.in_progress || 0} icon={Wrench} accent="#fbbf24" />
        <Stat label="Resolved" value={(stats.byStatus.resolved || 0) + (stats.byStatus.closed || 0)} icon={CheckCircle2} accent="#34d399" />
        <Stat label="Avg. resolution" value={stats.avgResolutionHours != null ? `${stats.avgResolutionHours} h` : '—'} icon={Timer} accent="#fb7185" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card">
          <h2 className="mb-2 font-semibold">By status</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={statusData}>
              <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
              <XAxis dataKey="name" interval={0} angle={-20} height={50} {...AXIS} />
              <YAxis allowDecimals={false} {...AXIS} />
              <Tooltip {...TIP} />
              <Bar dataKey="n" radius={[6, 6, 0, 0]}>{statusData.map((d) => <Cell key={d.name} fill={d.color} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h2 className="mb-2 font-semibold">By category</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stats.byCategory} layout="vertical">
              <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
              <XAxis type="number" allowDecimals={false} {...AXIS} />
              <YAxis type="category" dataKey="name" width={110} {...AXIS} />
              <Tooltip {...TIP} />
              <Bar dataKey="n" fill="#22d3ee" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h2 className="mb-2 font-semibold">New reports (30 days)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={stats.byDay}>
              <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} {...AXIS} />
              <YAxis allowDecimals={false} {...AXIS} />
              <Tooltip {...TIP} />
              <Line type="monotone" dataKey="count" stroke="#22d3ee" strokeWidth={2.5} dot={{ r: 3, fill: '#22d3ee' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card space-y-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <input className="input" placeholder="Search title or reference…" value={filters.q} onChange={set('q')} />
          <select className="input" value={filters.status} onChange={set('status')}>
            <option value="">All statuses</option>
            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select className="input" value={filters.category} onChange={set('category')}>
            <option value="">All categories</option>
            {meta.cats.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
          <select className="input" value={filters.priority} onChange={set('priority')}>
            <option value="">All priorities</option>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select className="input" value={filters.jurisdiction} onChange={set('jurisdiction')}>
            <option value="">All wards</option>
            {meta.wards.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
          </select>
          <select className="input" value={filters.assignedTo} onChange={set('assignedTo')}>
            <option value="">Anyone</option><option value="me">Assigned to me</option><option value="none">Unassigned</option>
          </select>
          <input className="input" type="date" value={filters.from} onChange={set('from')} title="From" />
          <input className="input" type="date" value={filters.to} onChange={set('to')} title="To" />
        </div>

        {!list && <Spinner />}
        {list?.items.length === 0 && <Empty text="No complaints match these filters." />}
        {list?.items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
                <tr><th className="py-2">Ref</th><th>Title</th><th>Category</th><th>Ward</th><th>Status</th><th>Priority</th><th>Assigned</th><th>Created</th></tr>
              </thead>
              <tbody>
                {list.items.map((c) => (
                  <tr key={c._id} className="border-b border-slate-200/60 transition hover:bg-white/5">
                    <td className="py-2.5 font-mono text-xs text-slate-500">{c.ref}</td>
                    <td className="max-w-[16rem] truncate"><Link className="font-medium text-cyan-300 hover:underline" to={`/complaints/${c._id}`}>{c.title}</Link></td>
                    <td>{c.category?.name}</td>
                    <td>{c.jurisdictionName}</td>
                    <td><StatusBadge status={c.status} /></td>
                    <td><PriorityBadge level={c.priority?.level} /></td>
                    <td>{c.assignedTo?.name || '—'}</td>
                    <td className="whitespace-nowrap text-xs text-slate-500">{fmt(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {list && list.pages > 1 && (
          <div className="flex items-center justify-between text-sm text-slate-600">
            <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
            <span>Page {list.page} of {list.pages} · {list.total} results</span>
            <button className="btn-secondary" disabled={page >= list.pages} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        )}
      </div>
    </div>
  );
}