import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Crosshair, ImagePlus, X, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, errMsg } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { LocationPicker } from '../components/maps.jsx';
import { FieldError, Spinner } from '../components/ui.jsx';

const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export default function ReportIssue() {
  const { user } = useAuth();
  const nav = useNavigate();
  const { register, handleSubmit, setValue, formState: { errors } } = useForm({ defaultValues: { jurisdictionId: user.jurisdiction } });
  const [cats, setCats] = useState(null);
  const [wards, setWards] = useState([]);
  const [pos, setPos] = useState(null);
  const [focusKey, setFocusKey] = useState(0);
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const submitting = useRef(false);
  const idemKey = useRef(crypto.randomUUID()); // same key for retries/double-clicks → server dedupes

  useEffect(() => {
    Promise.all([api.get(`/meta/categories?organizationId=${user.organization}`), api.get('/meta/organizations')])
      .then(([c, o]) => { setCats(c.data.categories); setWards(o.data.organizations.find((x) => x._id === user.organization)?.jurisdictions || []); })
      .catch((e) => toast.error(errMsg(e)));
  }, [user.organization]);
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach(URL.revokeObjectURL), [previews]);

  const useGps = () => {
    if (!navigator.geolocation) return toast.error('Your browser does not support location. Please pick a point on the map.');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setPos({ lat: p.coords.latitude, lng: p.coords.longitude }); setFocusKey((k) => k + 1); setLocating(false); },
      (err) => {
        setLocating(false);
        toast.error(err.code === 1 ? 'Location permission denied. Click the map to choose the location instead.' : err.code === 3 ? 'Location request timed out. Click the map to choose the location.' : 'Your location is unavailable. Click the map to choose it.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };
  const lookup = async () => {
    if (!pos) return toast.error('Choose a location first');
    try { const { data } = await api.get(`/geo/reverse?lat=${pos.lat}&lng=${pos.lng}`); if (data.address) setValue('address', data.address.slice(0, 300)); else toast('No address found for this point'); }
    catch (e) { toast.error(errMsg(e)); }
  };
  const addFiles = (e) => {
    const picked = [...e.target.files]; e.target.value = '';
    for (const f of picked) {
      if (!OK_TYPES.includes(f.type)) return toast.error('Only JPEG, PNG or WebP images are allowed');
      if (f.size > 5 * 1024 * 1024) return toast.error(`${f.name} is larger than 5 MB`);
    }
    setFiles((p) => [...p, ...picked].slice(0, 3));
  };

  const send = async (v, confirmNotDuplicate) => {
    const fd = new FormData();
    ['title', 'description', 'categoryId', 'jurisdictionId', 'address', 'landmark'].forEach((k) => v[k] && fd.append(k, v[k]));
    fd.append('latitude', pos.lat); fd.append('longitude', pos.lng);
    if (confirmNotDuplicate) fd.append('confirmNotDuplicate', 'true');
    files.forEach((f) => fd.append('images', f));
    return api.post('/complaints', fd, { headers: { 'Idempotency-Key': idemKey.current } });
  };
  const onSubmit = async (v) => {
    if (submitting.current) return; // block repeated clicks
    if (!pos) return toast.error('Please set the location (GPS or click on the map)');
    submitting.current = true; setBusy(true);
    try {
      let r;
      try { r = await send(v, false); }
      catch (e) {
        if (e.response?.data?.code !== 'POSSIBLE_DUPLICATE') throw e;
        const list = e.response.data.duplicates.map((d) => `• ${d.ref}: ${d.title}`).join('\n');
        if (!window.confirm(`Similar open reports exist nearby:\n\n${list}\n\nSubmit yours anyway?`)) return;
        r = await send(v, true);
      }
      toast.success('Complaint submitted'); nav(`/complaints/${r.data.complaint.id}`);
    } catch (e) { toast.error(e.response?.data?.errors?.[0]?.message || errMsg(e)); }
    finally { submitting.current = false; setBusy(false); }
  };

  if (!cats) return <Spinner />;
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-2xl font-bold">Report an issue</h1>
      <div className="card space-y-4">
        <div><label className="label">Title</label><input className="input" placeholder="e.g. Large pothole near bus stop" {...register('title', { required: 'Title is required', minLength: { value: 5, message: 'At least 5 characters' }, maxLength: 120 })} /><FieldError error={errors.title} /></div>
        <div><label className="label">Description</label><textarea rows={4} className="input" {...register('description', { required: 'Please describe the problem', minLength: { value: 10, message: 'At least 10 characters' }, maxLength: 2000 })} /><FieldError error={errors.description} /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">Category</label><select className="input" {...register('categoryId', { required: 'Choose a category' })}><option value="">Select…</option>{cats.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select><FieldError error={errors.categoryId} /></div>
          <div><label className="label">Ward / area</label><select className="input" {...register('jurisdictionId', { required: true })}>{wards.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}</select></div>
        </div>
      </div>
      <div className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Location</h2>
          <button type="button" className="btn-secondary" onClick={useGps} disabled={locating}><Crosshair className="h-4 w-4" />{locating ? 'Locating…' : 'Use my current location'}</button></div>
        <LocationPicker value={pos} onChange={setPos} focusKey={focusKey} />
        <p className="text-xs text-slate-500">{pos ? `Selected: ${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)} (drag the pin to adjust)` : 'Click the map to drop a pin, or use your current location.'}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">Address (optional)</label><div className="flex gap-2"><input className="input" {...register('address', { maxLength: 300 })} /><button type="button" className="btn-secondary" onClick={lookup} title="Look up address from pin"><Search className="h-4 w-4" /></button></div></div>
          <div><label className="label">Landmark (optional)</label><input className="input" {...register('landmark', { maxLength: 150 })} /></div>
        </div>
      </div>
      <div className="card space-y-3">
        <h2 className="font-semibold">Photographs <span className="text-sm font-normal text-slate-500">(up to 3, JPEG/PNG/WebP, 5 MB each)</span></h2>
        <div className="flex flex-wrap gap-3">
          {previews.map((src, i) => (<div key={src} className="relative"><img src={src} alt="" className="h-24 w-24 rounded-lg object-cover" /><button type="button" className="absolute -right-2 -top-2 rounded-full bg-red-600 p-1 text-white" onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}><X className="h-3 w-3" /></button></div>))}
          {files.length < 3 && <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 text-xs text-slate-500 hover:bg-slate-50"><ImagePlus className="h-5 w-5" />Add photo<input type="file" accept={OK_TYPES.join(',')} multiple capture="environment" className="hidden" onChange={addFiles} /></label>}
        </div>
      </div>
      <button className="btn-primary w-full py-3" disabled={busy}>{busy ? 'Submitting…' : 'Submit complaint'}</button>
    </form>
  );
}
