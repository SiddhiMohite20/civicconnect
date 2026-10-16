import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api, errMsg } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket, useSocketEvent } from '../context/SocketContext.jsx';
import { Spinner, ErrorBox, StatusBadge, PriorityBadge } from '../components/ui.jsx';
import { MiniMap } from '../components/maps.jsx';
import { STATUS, PRIORITIES, fmt } from '../lib/constants.js';

export default function ComplaintDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { socket } = useSocket();
  const [c, setC] = useState(null);
  const [comments, setComments] = useState([]);
  const [error, setError] = useState(null);
  const staff = user.role !== 'resident';

  const load = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([api.get(`/complaints/${id}`), api.get(`/complaints/${id}/comments`)]);
      setC(a.data.complaint); setComments(b.data.comments); setError(null);
    } catch (e) { setError(errMsg(e)); }
  }, [id]);
  useEffect(() => { setC(null); load(); }, [load]);

  // Join the complaint room (server verifies permission first); re-join after reconnects.
  useEffect(() => {
    if (!socket) return undefined;
    const join = () => socket.emit('complaint:join', id);
    join(); socket.on('connect', join);
    return () => { socket.off('connect', join); socket.emit('complaint:leave', id); };
  }, [socket, id]);
  useSocketEvent('complaint:updated', (p) => { if (p.id === id) load(); });

  if (error) return <ErrorBox message={error} onRetry={load} />;
  if (!c) return <Spinner />;
  const [lng, lat] = c.location.coordinates;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <div className="card space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div><div className="text-xs text-slate-500">{c.ref}</div><h1 className="text-xl font-bold">{c.title}</h1></div>
            <div className="flex items-center gap-2"><StatusBadge status={c.status} />{staff && <PriorityBadge level={c.priority.level} />}</div>
          </div>
          <p className="whitespace-pre-wrap text-slate-700">{c.description}</p>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-500">
            <span><b>Category:</b> {c.category?.name}</span><span><b>Area:</b> {c.jurisdictionName}</span>
            <span><b>Submitted:</b> {fmt(c.createdAt)}</span>
            {c.assignedTo && <span><b>Handled by:</b> {c.assignedTo.name}</span>}
          </div>
          {(c.address || c.landmark) && <div className="text-sm text-slate-600">{c.address}{c.landmark && ` · Near ${c.landmark}`}</div>}
          {c.images.length > 0 && <div className="flex flex-wrap gap-2">{c.images.map((im) => <a key={im.url} href={im.url} target="_blank" rel="noreferrer"><img src={im.url} alt="Complaint" className="h-28 w-28 rounded-lg object-cover" /></a>)}</div>}
          {staff && c.reporter && <div className="rounded-lg bg-slate-50 p-3 text-sm"><b>Reporter:</b> {c.reporter.name} · {c.reporter.email}{c.reporter.phone && ` · ${c.reporter.phone}`}</div>}
          {staff && c.flag?.type && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">Flagged as {c.flag.type}: {c.flag.note}</div>}
        </div>

        {c.resolution?.note && (
          <div className="card space-y-2 border-green-200 bg-green-50">
            <h2 className="font-semibold text-green-800">Resolution</h2>
            <p className="text-sm text-green-900">{c.resolution.note}</p>
            <div className="flex flex-wrap gap-2">{c.resolution.images.map((im) => <a key={im.url} href={im.url} target="_blank" rel="noreferrer"><img src={im.url} alt="Resolution" className="h-24 w-24 rounded-lg object-cover" /></a>)}</div>
            <div className="text-xs text-green-700">{fmt(c.resolution.at)}</div>
          </div>
        )}

        <Thread comments={comments} staff={staff} id={id} reload={load} closed={c.status === 'closed'} />
      </div>

      <div className="space-y-4">
        <div className="card space-y-2"><h2 className="font-semibold">Location</h2><MiniMap lat={lat} lng={lng} status={c.status} /></div>
        {c.allowedTransitions.includes('reopened') && !staff && <ReopenForm id={id} reload={load} />}
        {staff && <StaffPanel c={c} reload={load} />}
        <div className="card"><h2 className="mb-3 font-semibold">Status history</h2>
          <ol className="relative space-y-4 border-l border-slate-200 pl-4">
            {[...c.history].reverse().map((h, i) => (
              <li key={i} className="relative">
                <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full" style={{ background: STATUS[h.to]?.color }} />
                <div className="text-sm font-medium">{STATUS[h.to]?.label}{h.from && h.from !== h.to && <span className="font-normal text-slate-400"> from {STATUS[h.from]?.label}</span>}</div>
                {h.note && <div className="text-sm text-slate-600">{h.note}</div>}
                <div className="text-xs text-slate-400">{fmt(h.at)}{staff && h.actorName ? ` · ${h.actorName}` : ''}</div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

function Thread({ comments, staff, id, reload, closed }) {
  const [text, setText] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [busy, setBusy] = useState(false);
  const post = async (e) => {
    e.preventDefault(); if (busy || !text.trim()) return; setBusy(true);
    try { await api.post(`/complaints/${id}/comments`, { text, visibility }); setText(''); await reload(); } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };
  return (
    <div className="card space-y-3">
      <h2 className="font-semibold">{staff ? 'Updates & internal notes' : 'Comments & updates'}</h2>
      {comments.length === 0 && <p className="text-sm text-slate-400">No messages yet.</p>}
      {comments.map((m) => (
        <div key={m.id} className={`rounded-lg p-3 text-sm ${m.visibility === 'internal' ? 'border border-amber-200 bg-amber-50' : 'bg-slate-50'}`}>
          <div className="mb-1 flex items-center gap-2 text-xs text-slate-500"><b className="text-slate-700">{m.authorName}</b>{m.visibility === 'internal' && <span className="rounded bg-amber-200 px-1.5 text-amber-900">Internal – hidden from resident</span>}<span>{fmt(m.at)}</span></div>
          <p className="whitespace-pre-wrap">{m.text}</p>
        </div>
      ))}
      {!closed && (
        <form onSubmit={post} className="space-y-2">
          <textarea className="input" rows={2} maxLength={2000} placeholder={staff ? 'Write an update or note…' : 'Add a comment or clarification…'} value={text} onChange={(e) => setText(e.target.value)} />
          <div className="flex items-center justify-between gap-2">
            {staff ? <select className="input w-auto" value={visibility} onChange={(e) => setVisibility(e.target.value)}><option value="public">Public progress update</option><option value="internal">Internal note</option></select> : <span />}
            <button className="btn-primary" disabled={busy || !text.trim()}>{busy ? 'Posting…' : 'Post'}</button>
          </div>
        </form>
      )}
    </div>
  );
}

function ReopenForm({ id, reload }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await api.post(`/complaints/${id}/reopen`, { reason }); toast.success('Complaint reopened'); setReason(''); await reload(); } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={go} className="card space-y-2"><h2 className="font-semibold">Not fixed?</h2>
      <p className="text-sm text-slate-500">If the problem persists, tell us why and we will reopen the complaint.</p>
      <textarea className="input" rows={3} required minLength={5} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for reopening" />
      <button className="btn-danger w-full" disabled={busy}>Reopen complaint</button></form>
  );
}

function StaffPanel({ c, reload }) {
  const id = c.id;
  const [assignees, setAssignees] = useState([]);
  const [assignee, setAssignee] = useState('');
  const [to, setTo] = useState('');
  const [note, setNote] = useState('');
  const [files, setFiles] = useState([]);
  const [level, setLevel] = useState(c.priority.level);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get(`/complaints/${id}/assignees`).then((r) => setAssignees(r.data.assignees)).catch(() => {}); }, [id]);
  useEffect(() => { setLevel(c.priority.level); }, [c.priority.level]);

  const run = async (fn, ok) => { setBusy(true); try { await fn(); toast.success(ok); await reload(); } catch (e) { toast.error(e.response?.data?.errors?.[0]?.message || errMsg(e)); } finally { setBusy(false); } };
  const canAssign = ['under_review', 'assigned', 'in_progress', 'reopened'].includes(c.status);
  const needsNote = ['rejected', 'resolved', 'reopened'].includes(to);

  return (
    <div className="card space-y-5">
      <h2 className="font-semibold">Manage</h2>
      {c.allowedTransitions.length > 0 && (
        <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(); fd.append('status', to); if (note) fd.append('note', note); files.forEach((f) => fd.append('images', f)); run(async () => { await api.post(`/complaints/${id}/status`, fd); setTo(''); setNote(''); setFiles([]); }, 'Status updated'); }}>
          <label className="label">Change status</label>
          <select className="input" value={to} onChange={(e) => setTo(e.target.value)} required><option value="">Select next status…</option>{c.allowedTransitions.map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}</select>
          {to && <textarea className="input" rows={2} required={needsNote} placeholder={to === 'resolved' ? 'Resolution notes (required, visible to resident)' : to === 'rejected' ? 'Reason for rejection (required)' : 'Note (visible to resident)'} value={note} onChange={(e) => setNote(e.target.value)} />}
          {to === 'resolved' && <div><label className="label">Resolution photos (optional)</label><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => setFiles([...e.target.files].slice(0, 3))} className="text-sm" /></div>}
          <button className="btn-primary w-full" disabled={busy || !to}>Update status</button>
        </form>
      )}
      {c.status === 'submitted' && <p className="text-xs text-slate-500">Move to “Under review” before assigning.</p>}
      {canAssign && (
        <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); run(() => api.post(`/complaints/${id}/assign`, { assigneeId: assignee }), 'Assigned'); }}>
          <label className="label">Assign to</label>
          <select className="input" value={assignee} onChange={(e) => setAssignee(e.target.value)} required><option value="">Select staff member…</option>{assignees.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}</select>
          <button className="btn-secondary w-full" disabled={busy || !assignee}>{c.assignedTo ? 'Reassign' : 'Assign'}</button>
        </form>
      )}
      <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); run(async () => { await api.post(`/complaints/${id}/priority`, { level, reason }); setReason(''); }, 'Priority updated'); }}>
        <label className="label">Priority</label>
        <select className="input" value={level} onChange={(e) => setLevel(e.target.value)}>{PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}</select>
        <input className="input" required minLength={3} placeholder="Reason for priority (required)" value={reason} onChange={(e) => setReason(e.target.value)} />
        <button className="btn-secondary w-full" disabled={busy}>Set priority</button>
        {c.priority.reason && <p className="text-xs text-slate-500">Current: {c.priority.level} — {c.priority.reason}</p>}
      </form>
    </div>
  );
}
