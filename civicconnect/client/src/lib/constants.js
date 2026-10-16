export const STATUS = {
  submitted:    { label: 'Submitted',    color: '#94a3b8' },
  under_review: { label: 'Under review', color: '#a78bfa' },
  assigned:     { label: 'Assigned',     color: '#60a5fa' },
  in_progress:  { label: 'In progress',  color: '#fbbf24' },
  resolved:     { label: 'Resolved',     color: '#34d399' },
  rejected:     { label: 'Rejected',     color: '#fb7185' },
  reopened:     { label: 'Reopened',     color: '#fb923c' },
  closed:       { label: 'Closed',       color: '#2dd4bf' },
};

export const PRIORITIES = ['low', 'medium', 'high', 'critical'];

export const fmt = (d) =>
  d ? new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—';

export const TILE_URL = import.meta.env.VITE_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TILE_ATTR =
  import.meta.env.VITE_TILE_ATTRIBUTION ||
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
export const DEFAULT_CENTER = (import.meta.env.VITE_DEFAULT_CENTER || '18.5204,73.8567').split(',').map(Number);