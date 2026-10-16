import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { Spinner } from './components/ui.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import MyComplaints from './pages/MyComplaints.jsx';
import ReportIssue from './pages/ReportIssue.jsx';
import ComplaintDetail from './pages/ComplaintDetail.jsx';
import MapView from './pages/MapView.jsx';
import StaffDashboard from './pages/StaffDashboard.jsx';
import AdminPanel from './pages/AdminPanel.jsx';
import Notifications from './pages/Notifications.jsx';
import Profile from './pages/Profile.jsx';

// UX-only guard. Real authorization is enforced by the API on every request.
function Guard({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}
function Home() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'resident' ? '/my' : '/staff'} replace />;
}
function Public({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  return user ? <Navigate to="/" replace /> : children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Public><Login /></Public>} />
      <Route path="/register" element={<Public><Register /></Public>} />
      <Route element={<Guard><Layout /></Guard>}>
        <Route path="/" element={<Home />} />
        <Route path="/my" element={<Guard roles={['resident']}><MyComplaints /></Guard>} />
        <Route path="/report" element={<Guard roles={['resident']}><ReportIssue /></Guard>} />
        <Route path="/complaints/:id" element={<ComplaintDetail />} />
        <Route path="/map" element={<MapView />} />
        <Route path="/staff" element={<Guard roles={['staff', 'admin']}><StaffDashboard /></Guard>} />
        <Route path="/admin" element={<Guard roles={['admin']}><AdminPanel /></Guard>} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/profile" element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
