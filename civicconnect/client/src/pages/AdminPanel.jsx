import { useCallback, useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, errMsg } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Spinner, ErrorBox, Empty, StatusBadge } from '../components/ui.jsx';
import { fmt } from '../lib/constants.js';

const TABS = ['Users', 'Setup', 'Review queue', 'Audit log', 'Reports'];

export default function AdminPanel() {
  const [tab, setTab] = useState('Users');
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Administration</h1>
      <div className="flex flex-wrap gap-1 border-b">{TABS.map((t) => <button key={t} onClick={() => setTab(t)} className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === t ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{t}</button>)}</div>
      {tab === 'Users' && <Users />}{tab === 'Setup' && <Setup />}{tab === 'Review queue' && <Review />}{tab === 'Audit log' && <Audit />}{tab === 'Reports' && <Reports />}
    </div>
  );
}

const useWards = () => {
  const [setup, setSetup] = useState(null);
  const reload = useCallback(() => api.get('/admin/setup').then((r) => setSetup(r.data)).catch((e) => toast.error(errMsg(e))), []);
  useEffect(() => { reload(); }, [reload]);
  return [setup, reload];
};

function Users() {
  const { user: me } = useAuth();
  const [data, setData] = useState(null);
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const [setup] = useWards();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'staff', jurisdictions: [] });
  const load = useCallback(() => api.get('/admin/users', { params: { q: q || undefined, role: role || undefined, page } }).then((r) => setData(r.data)).catch((e) => toast.error(errMsg(e))), [q, role, page]);
  useEffect(() => { load(); }, [load]);
  const patch = async (id, body, ok) => { try { await api.patch(`/admin/users/${id}`, body); toast.success(ok); load(); } catch (e) { toast.error(errMsg(e)); } };
  const create = async (e) => { e.preventDefault(); try { await api.post('/admin/users', form); toast.success('Account created'); setForm({ name: '', email: '', password: '', role: 'staff', jurisdictions: [] }); load(); } catch (err) { toast.error(err.response?.data?.errors?.[0]?.message || errMsg(err)); } };
  const wards = setup?.organization.jurisdictions || [];
  const toggle = (arr, id) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);

  return (
    <div className="space-y-4">
      <form onSubmit={create} className="card space-y-3"><h2 className="font-semibold">Create staff / admin account</h2>
        <div className="grid gap-2 sm:grid-cols-4">
          <input className="input" required placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="input" required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="input" required type="password" placeholder="Temporary password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="staff">Staff</option><option value="admin">Admin</option></select></div>
        {form.role === 'staff' && <div className="flex flex-wrap gap-3 text-sm"><span className="text-slate-500">Wards (none = all):</span>{wards.map((w) => <label key={w._id} className="flex items-center gap-1"><input type="checkbox" checked={form.jurisdictions.includes(w._id)} onChange={() => setForm({ ...form, jurisdictions: toggle(form.jurisdictions, w._id) })} />{w.name}</label>)}</div>}
        <button className="btn-primary">Create account</button></form>
      <div className="card space-y-3">
        <div className="flex gap-2"><input className="input" placeholder="Search name or email…" value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} /><select className="input w-auto" value={role} onChange={(e) => { setPage(1); setRole(e.target.value); }}><option value="">All roles</option><option value="resident">Residents</option><option value="staff">Staff</option><option value="admin">Admins</option></select></div>
        {!data ? <Spinner /> : data.items.length === 0 ? <Empty text="No users found." /> : (
          <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b text-xs uppercase text-slate-500"><tr><th className="py-2">Name</th><th>Email</th><th>Role</th><th>Wards</th><th>Status</th><th /></tr></thead>
            <tbody>{data.items.map((u) => (
              <tr key={u._id} className="border-b border-slate-100 align-top">
                <td className="py-2">{u.name}</td><td>{u.email}</td>
                <td><select className="rounded border border-slate-200 px-1 py-0.5 text-sm" value={u.role} disabled={u._id === me._id} onChange={(e) => patch(u._id, { role: e.target.value }, 'Role updated')}><option value="resident">resident</option><option value="staff">staff</option><option value="admin">admin</option></select></td>
                <td className="text-xs">{u.role === 'staff' ? <div className="flex flex-wrap gap-2">{wards.map((w) => <label key={w._id} className="flex items-center gap-1"><input type="checkbox" checked={(u.jurisdictions || []).includes(w._id)} onChange={() => patch(u._id, { jurisdictions: toggle(u.jurisdictions || [], w._id) }, 'Scope updated')} />{w.name}</label>)}{!(u.jurisdictions || []).length && <span className="text-slate-400">all wards</span>}</div> : '—'}</td>
                <td>{u.isActive ? <span className="text-green-700">Active</span> : <span className="text-red-600" title={u.suspendedReason}>Suspended</span>}</td>
                <td>{u._id !== me._id && (u.isActive ? <button className="btn-secondary !px-2 !py-1" onClick={() => { const r = window.prompt('Reason for suspension?'); if (r) patch(u._id, { isActive: false, suspendedReason: r }, 'Account suspended'); }}>Suspend</button> : <button className="btn-secondary !px-2 !py-1" onClick={() => patch(u._id, { isActive: true }, 'Account reactivated')}>Reactivate</button>)}</td>
              </tr>))}</tbody></table></div>)}
        {data?.pages > 1 && <div className="flex justify-between text-sm"><button className="btn-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {data.page}/{data.pages}</span><button className="btn-secondary" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Next</button></div>}
      </div>
    </div>
  );
}

function Setup() {
  const [setup, reload] = useWards();
  const [cat, setCat] = useState({ name: '', color: '#64748b' });
  const [ward, setWard] = useState('');
  if (!setup) return <Spinner />;
  const run = async (fn, ok) => { try { await fn(); toast.success(ok); reload(); } catch (e) { toast.error(e.response?.data?.errors?.[0]?.message || errMsg(e)); } };
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="card space-y-3"><h2 className="font-semibold">Complaint categories</h2>
        {setup.categories.map((c) => (<div key={c._id} className="flex items-center gap-2 text-sm"><span className="h-3 w-3 rounded-full" style={{ background: c.color }} /><span className={`flex-1 ${c.isActive ? '' : 'text-slate-400 line-through'}`}>{c.name}</span><button className="btn-secondary !px-2 !py-1" onClick={() => run(() => api.patch(`/admin/categories/${c._id}`, { isActive: !c.isActive }), 'Updated')}>{c.isActive ? 'Disable' : 'Enable'}</button></div>))}
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); run(async () => { await api.post('/admin/categories', cat); setCat({ name: '', color: '#64748b' }); }, 'Category added'); }}>
          <input className="input" required placeholder="New category" value={cat.name} onChange={(e) => setCat({ ...cat, name: e.target.value })} /><input type="color" className="h-10 w-12 rounded border" value={cat.color} onChange={(e) => setCat({ ...cat, color: e.target.value })} /><button className="btn-primary">Add</button></form></div>
      <div className="card space-y-3"><h2 className="font-semibold">Jurisdictions / wards</h2>
        {setup.organization.jurisdictions.map((j) => (<div key={j._id} className="flex items-center gap-2 text-sm"><span className={`flex-1 ${j.isActive ? '' : 'text-slate-400 line-through'}`}>{j.name}</span><button className="btn-secondary !px-2 !py-1" onClick={() => run(() => api.patch(`/admin/jurisdictions/${j._id}`, { isActive: !j.isActive }), 'Updated')}>{j.isActive ? 'Disable' : 'Enable'}</button></div>))}
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); run(async () => { await api.post('/admin/jurisdictions', { name: ward }); setWard(''); }, 'Ward added'); }}>
          <input className="input" required placeholder="New ward / area" value={ward} onChange={(e) => setWard(e.target.value)} /><button className="btn-primary">Add</button></form></div>
    </div>
  );
}

function Review() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(() => api.get('/admin/review-queue').then((r) => setItems(r.data.items)).catch((e) => setError(errMsg(e))), []);
  useEffect(() => { load(); }, [load]);
  const flag = async (id, type) => { try { await api.post(`/admin/complaints/${id}/flag`, { type, note: type === 'spam' ? 'Spam / abusive report' : 'Duplicate of an existing report' }); toast.success('Marked'); load(); } catch (e) { toast.error(errMsg(e)); } };
  const dismiss = async (id) => { try { await api.post(`/admin/complaints/${id}/dismiss`); load(); } catch (e) { toast.error(errMsg(e)); } };
  if (error) return <ErrorBox message={error} onRetry={load} />;
  if (!items) return <Spinner />;
  if (!items.length) return <Empty text="Nothing awaiting review." />;
  return (
    <div className="space-y-2">{items.map((c) => (
      <div key={c._id} className="card flex flex-wrap items-center gap-3 text-sm">
        <div className="min-w-0 flex-1"><div className="font-medium">{c.ref} — {c.title}</div>
          <div className="text-xs text-slate-500">{c.flag?.type ? `Flagged as ${c.flag.type}` : c.duplicateSuspectOf ? `Possible duplicate of ${c.duplicateSuspectOf.ref} (${c.duplicateSuspectOf.title})` : ''} · {fmt(c.createdAt)}</div></div>
        <StatusBadge status={c.status} />
        {!c.flag?.type && <><button className="btn-secondary" onClick={() => flag(c._id, 'duplicate')}>Duplicate</button><button className="btn-danger" onClick={() => flag(c._id, 'spam')}>Spam</button><button className="btn-secondary" onClick={() => dismiss(c._id)}>Not a problem</button></>}
      </div>))}</div>
  );
}

function Audit() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  useEffect(() => { api.get('/admin/audit', { params: { page } }).then((r) => setData(r.data)).catch((e) => toast.error(errMsg(e))); }, [page]);
  if (!data) return <Spinner />;
  return (
    <div className="card space-y-2">
      {data.items.length === 0 && <Empty text="No audit entries yet." />}
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><tbody>{data.items.map((a) => (<tr key={a._id} className="border-b border-slate-100"><td className="whitespace-nowrap py-1.5 text-xs text-slate-500">{fmt(a.createdAt)}</td><td>{a.actorName}</td><td className="font-mono text-xs">{a.action}</td><td className="text-xs text-slate-500">{a.meta ? JSON.stringify(a.meta) : ''}</td></tr>))}</tbody></table></div>
      {data.pages > 1 && <div className="flex justify-between text-sm"><button className="btn-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {data.page}/{data.pages}</span><button className="btn-secondary" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Next</button></div>}
    </div>
  );
}

function Reports() {
  const [range, setRange] = useState({ from: '', to: '' });
  const download = async () => {
    try {
      const params = {}; if (range.from) params.from = new Date(range.from).toISOString(); if (range.to) params.to = new Date(`${range.to}T23:59:59`).toISOString();
      const r = await api.get('/admin/export/complaints.csv', { params, responseType: 'blob' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(r.data); a.download = 'complaints.csv'; a.click(); URL.revokeObjectURL(a.href);
    } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div className="card max-w-lg space-y-3"><h2 className="font-semibold">Export complaints (CSV)</h2>
      <p className="text-sm text-slate-500">Includes reference, category, area, status, priority and timings. Reporter personal data is not exported.</p>
      <div className="flex gap-2"><input type="date" className="input" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /><input type="date" className="input" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></div>
      <button className="btn-primary" onClick={download}><Download className="h-4 w-4" />Download CSV</button></div>
  );
}
