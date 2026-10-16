import { Link } from 'react-router-dom';
import { CheckCheck } from 'lucide-react';
import { useSocket } from '../context/SocketContext.jsx';
import { Empty } from '../components/ui.jsx';
import { fmt } from '../lib/constants.js';

export default function Notifications() {
  const { notifications, unread, markRead, markAllRead } = useSocket();
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">Notifications</h1>{unread > 0 && <button className="btn-secondary" onClick={markAllRead}><CheckCheck className="h-4 w-4" />Mark all read</button>}</div>
      {notifications.length === 0 && <Empty text="You're all caught up." />}
      <div className="space-y-2">
        {notifications.map((n) => {
          const body = (<><div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${n.readAt ? 'bg-transparent' : 'bg-blue-600'}`} /><span className="font-medium">{n.title}</span></div>{n.body && <p className="ml-4 text-sm text-slate-600">{n.body}</p>}<div className="ml-4 text-xs text-slate-400">{fmt(n.createdAt)}</div></>);
          return n.complaint
            ? <Link key={n._id} to={`/complaints/${n.complaint}`} onClick={() => !n.readAt && markRead(n._id)} className="card block hover:shadow-md">{body}</Link>
            : <div key={n._id} className="card">{body}</div>;
        })}
      </div>
    </div>
  );
}
