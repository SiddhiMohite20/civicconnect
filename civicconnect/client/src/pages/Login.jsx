import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext.jsx';
import { errMsg } from '../lib/api.js';

export default function Login() {
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await login(form.email, form.password); } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };
  return (
    <div className="mx-auto mt-16 max-w-sm px-4">
      <div className="mb-6 text-center"><MapPin className="mx-auto h-8 w-8 text-blue-600" /><h1 className="mt-2 text-2xl font-bold">CivicConnect</h1><p className="text-sm text-slate-500">Report and track local civic issues</p></div>
      <form onSubmit={submit} className="card space-y-4">
        <div><label className="label">Email</label><input className="input" type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div><label className="label">Password</label><input className="input" type="password" required autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <p className="text-center text-sm text-slate-500">New resident? <Link className="text-blue-600 underline" to="/register">Create an account</Link></p>
      </form>
    </div>
  );
}
