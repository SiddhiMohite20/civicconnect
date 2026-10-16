import { useState } from 'react';
import toast from 'react-hot-toast';
import { api, errMsg } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Profile() {
  const { user, setUser } = useAuth();
  const [f, setF] = useState({ name: user.name, phone: user.phone || '', currentPassword: '', newPassword: '' });
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const body = { name: f.name, phone: f.phone };
      if (f.newPassword) { body.currentPassword = f.currentPassword; body.newPassword = f.newPassword; }
      const { data } = await api.patch('/auth/profile', body);
      setUser(data.user); setF({ ...f, currentPassword: '', newPassword: '' }); toast.success('Profile saved');
    } catch (err) { toast.error(err.response?.data?.errors?.[0]?.message || errMsg(err)); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={save} className="card mx-auto max-w-md space-y-4">
      <h1 className="text-xl font-bold">Your profile</h1>
      <div><label className="label">Email</label><input className="input bg-slate-50" value={user.email} disabled /></div>
      <div><label className="label">Role</label><input className="input bg-slate-50 capitalize" value={user.role} disabled /></div>
      <div><label className="label">Name</label><input className="input" required minLength={2} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
      <div><label className="label">Phone</label><input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
      <details className="rounded-lg border border-slate-200 p-3"><summary className="cursor-pointer text-sm font-medium">Change password</summary>
        <div className="mt-3 space-y-3"><input className="input" type="password" placeholder="Current password" autoComplete="current-password" value={f.currentPassword} onChange={(e) => setF({ ...f, currentPassword: e.target.value })} /><input className="input" type="password" placeholder="New password (8+ chars, letters & numbers)" autoComplete="new-password" value={f.newPassword} onChange={(e) => setF({ ...f, newPassword: e.target.value })} /></div></details>
      <button className="btn-primary w-full" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
    </form>
  );
}
