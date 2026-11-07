import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import { ErrorBoundary, Spinner } from './components/ui';
import Motion from './components/Motion';
import { homeFor } from './utils/format';
import Landing from './pages/Landing';
import { ChooseAccountType, ForgotPassword, Login, RegisterBusiness, RegisterIndividual, ResetPassword, VerifyEmail } from './pages/Auth';
import { Privacy, Terms } from './pages/Legal';
import Dashboard from './pages/Dashboard';
import Tracker from './pages/Tracker';
import Goals from './pages/Goals';
import Challenges from './pages/Challenges';
import Leaderboard from './pages/Leaderboard';
import Tips from './pages/Tips';
import Communities from './pages/Communities';
import CommunityDetail from './pages/CommunityDetail';
import Compare from './pages/Compare';
import Notifications from './pages/Notifications';
import Settings from './pages/Settings';
import BusinessOverview from './pages/BusinessOverview';
import BusinessMembers from './pages/BusinessMembers';
import BusinessChallenges from './pages/BusinessChallenges';
import { AdminCommunities, AdminOverview, AdminReports, AdminUsers } from './pages/Admin';

// Signed-in only; `role` limits a page to one account type ('user', 'business' or 'admin')
function Protected({ children, role }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <Spinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (role && user.role !== role) return <Navigate to={homeFor(user)} replace />;
  return children;
}

function PublicOnly({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <Spinner />;
  return user ? <Navigate to={homeFor(user)} replace /> : children;
}

export default function App() {
  const location = useLocation();
  const page = (el, role) => <Protected role={role}><ErrorBoundary resetKey={location.pathname}>{el}</ErrorBoundary></Protected>;

  return (
    <>
    <Motion />
    <Routes>
      {/* Public pages */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<ChooseAccountType />} />
      <Route path="/register/individual" element={<RegisterIndividual />} />
      <Route path="/register/business" element={<RegisterBusiness />} />
      <Route path="/forgot-password" element={<PublicOnly><ForgotPassword /></PublicOnly>} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/welcome" element={<Navigate to="/" replace />} />

      {/* Signed-in app */}
      <Route element={<Protected><Layout /></Protected>}>
        {/* Individual accounts */}
        <Route path="dashboard" element={page(<Dashboard />, 'user')} />
        <Route path="challenges" element={page(<Challenges />, 'user')} />
        <Route path="leaderboard" element={page(<Leaderboard />, 'user')} />
        <Route path="tips" element={page(<Tips />, 'user')} />
        {/* Business accounts */}
        <Route path="business" element={page(<BusinessOverview />, 'business')} />
        <Route path="business/members" element={page(<BusinessMembers />, 'business')} />
        <Route path="business/challenges" element={page(<BusinessChallenges />, 'business')} />
        {/* Platform admin (no registration: created from server .env) */}
        <Route path="admin" element={page(<AdminOverview />, 'admin')} />
        <Route path="admin/users" element={page(<AdminUsers />, 'admin')} />
        <Route path="admin/communities" element={page(<AdminCommunities />, 'admin')} />
        <Route path="admin/reports" element={page(<AdminReports />, 'admin')} />
        {/* Shared (content adapts to the account type) */}
        <Route path="tracker" element={page(<Tracker />)} />
        <Route path="goals" element={page(<Goals />)} />
        <Route path="communities" element={page(<Communities />)} />
        <Route path="communities/:id" element={page(<CommunityDetail />)} />
        <Route path="compare" element={page(<Compare />)} />
        <Route path="notifications" element={page(<Notifications />)} />
        <Route path="settings" element={page(<Settings />)} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}
