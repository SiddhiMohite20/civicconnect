import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext.jsx';
import { api, errMsg } from '../lib/api.js';
import { FieldError, Spinner } from '../components/ui.jsx';

export default function Register() {
  const { register: signUp } = useAuth();
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm();
  const [orgs, setOrgs] = useState(null);
  useEffect(() => { api.get('/meta/organizations').then((r) => setOrgs(r.data.organizations)).catch((e) => toast.error(errMsg(e))); }, []);
  const orgId = watch('organizationId');
  const wards = orgs?.find((o) => o._id === orgId)?.jurisdictions || [];
  const onSubmit = async (v) => { try { await signUp(v); } catch (e) { toast.error(e.response?.data?.errors?.[0]?.message || errMsg(e)); } };
  if (!orgs) return <Spinner />;
  return (
    <div className="mx-auto mt-10 max-w-md px-4">
      <h1 className="mb-4 text-2xl font-bold">Create your resident account</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="card space-y-4">
        <div><label className="label">Full name</label><input className="input" {...register('name', { required: 'Name is required', minLength: { value: 2, message: 'Too short' } })} /><FieldError error={errors.name} /></div>
        <div><label className="label">Email</label><input className="input" type="email" {...register('email', { required: 'Email is required' })} /><FieldError error={errors.email} /></div>
        <div><label className="label">Phone (optional)</label><input className="input" {...register('phone')} /></div>
        <div><label className="label">Password</label><input className="input" type="password" autoComplete="new-password" {...register('password', { required: 'Password is required', minLength: { value: 8, message: 'At least 8 characters' }, validate: (v) => (/[A-Za-z]/.test(v) && /\d/.test(v)) || 'Use letters and numbers' })} /><FieldError error={errors.password} /></div>
        <div><label className="label">Municipality / society</label>
          <select className="input" {...register('organizationId', { required: 'Please choose one' })}><option value="">Select…</option>{orgs.map((o) => <option key={o._id} value={o._id}>{o.name}</option>)}</select><FieldError error={errors.organizationId} /></div>
        <div><label className="label">Your ward / area</label>
          <select className="input" disabled={!orgId} {...register('jurisdictionId', { required: 'Please choose your area' })}><option value="">Select…</option>{wards.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}</select><FieldError error={errors.jurisdictionId} /></div>
        <button className="btn-primary w-full" disabled={isSubmitting}>{isSubmitting ? 'Creating…' : 'Create account'}</button>
        <p className="text-center text-sm text-slate-500">Already registered? <Link className="text-blue-600 underline" to="/login">Sign in</Link></p>
      </form>
    </div>
  );
}
