import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Link } from 'react-router-dom';
import { STATUS, TILE_URL, TILE_ATTR, DEFAULT_CENTER, fmt } from '../lib/constants.js';
import { StatusBadge } from './ui.jsx';

const dot = (color) => L.divIcon({ className: '', html: `<span class="marker-dot" style="background:${color}"></span>`, iconSize: [18, 18], iconAnchor: [9, 9], popupAnchor: [0, -10] });
const Tiles = () => <TileLayer url={TILE_URL} attribution={TILE_ATTR} maxZoom={19} />;

function Clicker({ onPick }) { useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) }); return null; }
function Fly({ pos, focusKey }) {
  const map = useMap();
  useEffect(() => { if (pos) map.flyTo([pos.lat, pos.lng], Math.max(map.getZoom(), 17)); }, [focusKey]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

// Location picker used on the report form (click map / drag pin / GPS).
export function LocationPicker({ value, onChange, focusKey }) {
  const center = value ? [value.lat, value.lng] : DEFAULT_CENTER;
  return (
    <MapContainer center={center} zoom={value ? 17 : 12} className="h-72 w-full rounded-lg border border-slate-300" scrollWheelZoom>
      <Tiles />
      <Clicker onPick={onChange} />
      <Fly pos={value} focusKey={focusKey} />
      {value && <Marker position={[value.lat, value.lng]} icon={dot('#2563eb')} draggable eventHandlers={{ dragend: (e) => { const p = e.target.getLatLng(); onChange({ lat: p.lat, lng: p.lng }); } }} />}
    </MapContainer>
  );
}

// Read-only single marker (complaint detail).
export function MiniMap({ lat, lng, status }) {
  return (
    <MapContainer center={[lat, lng]} zoom={16} className="h-56 w-full rounded-lg border border-slate-200" scrollWheelZoom={false}>
      <Tiles /><Marker position={[lat, lng]} icon={dot(STATUS[status]?.color || '#2563eb')} />
    </MapContainer>
  );
}

// Public overview map: marker colour = status. Staff (and owners) can open details; others see a summary.
export function ComplaintMap({ markers, canOpen, height = 'h-[28rem]' }) {
  return (
    <MapContainer center={DEFAULT_CENTER} zoom={12} className={`${height} w-full rounded-lg border border-slate-200`} scrollWheelZoom>
      <Tiles />
      <FitTo markers={markers} />
      {markers.map((m) => (
        <Marker key={m.id} position={[m.lat, m.lng]} icon={dot(STATUS[m.status]?.color || '#64748b')}>
          <Popup>
            <div className="space-y-1 text-sm">
              <div className="font-semibold">{m.title}</div>
              <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: m.category?.color }} />{m.category?.name}</div>
              <StatusBadge status={m.status} />
              <div className="text-xs text-slate-500">{m.ref} · {m.area} · {fmt(m.createdAt)}</div>
              {canOpen(m) && <Link className="text-blue-600 underline" to={`/complaints/${m.id}`}>Open details</Link>}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
function FitTo({ markers }) {
  const map = useMap();
  useEffect(() => {
    if (markers.length) map.fitBounds(L.latLngBounds(markers.map((m) => [m.lat, m.lng])), { padding: [40, 40], maxZoom: 16 });
  }, [markers.length]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
