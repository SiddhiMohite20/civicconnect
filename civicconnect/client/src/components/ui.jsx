
import { Loader2, AlertCircle, Inbox } from 'lucide-react';
import { STATUS } from '../lib/constants.js';

export const Spinner = ({ text = 'Loading…' }) => (
  <div className="flex items-center justify-center gap-2 py-12 text-slate-400">
    <Loader2 className="h-5 w-5 animate-spin text-cyan-300" />
    {text}
  </div>
);

export const ErrorBox = ({ message, onRetry }) => (
  <div className="flex items-center gap-3 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">
    <AlertCircle className="h-5 w-5 shrink-0 text-red-300" />
    <span className="flex-1">{message}</span>
    {onRetry && (
      <button className="btn-secondary" onClick={onRetry}>
        Retry
      </button>
    )}
  </div>
);

export const Empty = ({ text = 'Nothing here yet.' }) => (
  <div className="flex flex-col items-center gap-3 py-12 text-slate-400">
    <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/15 bg-cyan-300/5">
      <Inbox className="h-7 w-7 text-cyan-300" />
    </span>
    <p className="text-sm">{text}</p>
  </div>
);

export const StatusBadge = ({ status }) => {
  const s = STATUS[status] || { label: status, color: '#94A3B8' };

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
      style={{
        background: `${s.color}18`,
        color: s.color,
        borderColor: `${s.color}45`,
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{
          background: s.color,
          boxShadow: `0 0 8px ${s.color}90`,
        }}
      />
      {s.label}
    </span>
  );
};

export const PriorityBadge = ({ level }) => {
  const styles = {
    low: 'border-slate-400/20 bg-slate-400/10 text-slate-300',
    medium: 'border-sky-400/20 bg-sky-400/10 text-sky-300',
    high: 'border-orange-400/20 bg-orange-400/10 text-orange-300',
    critical: 'border-red-400/20 bg-red-400/10 text-red-300',
  };

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${
        styles[level] || styles.low
      }`}
    >
      {level}
    </span>
  );
};

export const FieldError = ({ error }) =>
  error ? <p className="err">{error.message}</p> : null;
