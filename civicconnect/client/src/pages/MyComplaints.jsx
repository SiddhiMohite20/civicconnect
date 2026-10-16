import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { api, errMsg } from '../lib/api.js';
import { useSocketEvent } from '../context/SocketContext.jsx';
import { Spinner, ErrorBox, Empty, StatusBadge } from '../components/ui.jsx';
import { fmt } from '../lib/constants.js';

export default function MyComplaints() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(() => api.get('/complaints/mine').then((r) => { setItems(r.data.complaints); setError(null); }).catch((e) => setError(errMsg(e))), []);
  useEffect(() => { load(); }, [load]);
  useSocketEvent('complaint:updated', load); // live status changes without refresh
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">My reports</h1><Link to="/report" className="btn-primary"><Plus className="h-4 w-4" />Report an issue</Link></div>
      {error && <ErrorBox message={error} onRetry={load} />}
      {!items && !error && <Spinner />}
      {items?.length === 0 && <Empty text="You haven't reported anything yet." />}
      <div className="grid gap-3 sm:grid-cols-2">
        {items?.map((c) => (
          <Link key={c._id} to={`/complaints/${c._id}`} className="card flex gap-3 transition hover:shadow-md">
            {c.images?.[0] ? <img src={c.images[0].url} alt="" className="h-20 w-20 rounded-lg object-cover" /> : <div className="h-20 w-20 rounded-lg bg-slate-100" />}
            <div className="min-w-0 flex-1 space-y-1">
              <div className="truncate font-semibold">{c.title}</div>
              <div className="text-xs text-slate-500">{c.ref} · {c.category?.name}</div>
              <StatusBadge status={c.status} />
              <div className="text-xs text-slate-400">{fmt(c.createdAt)}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
