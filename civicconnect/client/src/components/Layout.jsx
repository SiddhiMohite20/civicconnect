import { NavLink, Outlet, Link } from 'react-router-dom';
import { Bell, MapPin, LayoutDashboard, FilePlus2, ListChecks, Shield, LogOut, UserCircle, Radio } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';

export default function Layout() {
  const { user, logout } = useAuth();
  const { unread, connected } = useSocket();
  const resident = user.role === 'resident';

  const item = ({ isActive }) =>
    `flex items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium transition ${
      isActive
        ? 'bg-gradient-to-r from-cyan-400/20 to-transparent text-cyan-300 ring-1 ring-cyan-400/30'
        : 'text-slate-600 hover:bg-white/5 hover:text-slate-900'
    }`;

  return (
    <div className="min-h-screen lg:flex">
      <aside className="sticky top-0 z-[1100] flex items-center gap-3 border-b border-slate-200 bg-ink-900/90 p-3 backdrop-blur lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col lg:items-stretch lg:gap-6 lg:border-b-0 lg:border-r lg:p-5">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-teal-500 text-ink-950 shadow-glow">
            <MapPin className="h-5 w-5" />
          </span>
          <span className="font-display text-lg font-extrabold tracking-tight text-slate-900">
            Civic<span className="text-cyan-400">Connect</span>
          </span>
        </Link>

        <nav className="flex flex-1 gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          {!resident && <NavLink to="/staff" className={item}><LayoutDashboard className="h-4 w-4" />Dashboard</NavLink>}
          {resident && <NavLink to="/my" className={item}><ListChecks className="h-4 w-4" />My reports</NavLink>}
          {resident && <NavLink to="/report" className={item}><FilePlus2 className="h-4 w-4" />Report issue</NavLink>}
          <NavLink to="/map" className={item}><MapPin className="h-4 w-4" />Community map</NavLink>
          <NavLink to="/notifications" className={item}>
            <Bell className="h-4 w-4" />Notifications
            {unread > 0 && (
              <span className="ml-auto rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </NavLink>
          {user.role === 'admin' && <NavLink to="/admin" className={item}><Shield className="h-4 w-4" />Administration</NavLink>}
        </nav>

        <div className="hidden space-y-3 lg:block">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-ink-800/70 px-3 py-2 text-xs text-slate-500">
            <Radio className={`h-3.5 w-3.5 ${connected ? 'text-emerald-400' : 'animate-pulse text-amber-400'}`} />
            {connected ? 'Live updates on' : 'Reconnecting…'}
          </div>
          <NavLink to="/profile" className={item}>
            <UserCircle className="h-5 w-5" />
            <span className="min-w-0">
              <span className="block truncate">{user.name}</span>
              <span className="block text-[11px] capitalize text-slate-500">{user.role}</span>
            </span>
          </NavLink>
          <button className="btn-secondary w-full" onClick={logout}><LogOut className="h-4 w-4" />Log out</button>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <NavLink to="/profile" className="btn-secondary !px-2"><UserCircle className="h-5 w-5" /></NavLink>
          <button className="btn-secondary !px-2" onClick={logout} aria-label="Log out"><LogOut className="h-4 w-4" /></button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-4 sm:p-8">
        <div className="mx-auto max-w-6xl"><Outlet /></div>
      </main>
    </div>
  );
}